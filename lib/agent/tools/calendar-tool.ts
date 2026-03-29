import { google } from "googleapis";
import { getGoogleAuthForUser } from "@/lib/integrations/google-user-auth";
import {
  browseMicrosoftCalendarAvailability,
  listMicrosoftCalendarEvents
} from "@/lib/integrations/microsoft-graph-calendar";
import { fetchUserIntegrationSettings } from "@/lib/integrations/user-integration-settings";

export type CalendarTimeRange = { start: string; end: string };

export type ViewingSlotsResult = {
  slots: CalendarTimeRange[];
  /** Obsazené úseky z Google Calendar (free/busy). */
  busy: CalendarTimeRange[];
  rangeStart: string;
  rangeEnd: string;
};

/** Výstup nástroje browseCalendarAvailability — pouze prohlížení obsazenosti + časové okno. */
export type CalendarAvailabilityResult = Pick<ViewingSlotsResult, "busy" | "rangeStart" | "rangeEnd">;

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Google Calendar free/busy v zadaném horizontu (read-only).
 */
export async function browseCalendarAvailability(params: {
  userId: string;
  daysAhead?: number;
}): Promise<CalendarAvailabilityResult> {
  const settings = await fetchUserIntegrationSettings(params.userId);
  const calendarProvider = settings?.calendar_provider ?? "google";

  if (calendarProvider === "microsoft") {
    return browseMicrosoftCalendarAvailability({
      userId: params.userId,
      daysAhead: params.daysAhead
    });
  }

  const { auth, calendarId } = await getGoogleAuthForUser({
    userId: params.userId,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
  });
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const daysAhead = params.daysAhead ?? 7;
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const busyResult = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }]
    }
  });

  const rawBusy = busyResult.data.calendars?.[calendarId]?.busy ?? [];
  const busy: CalendarTimeRange[] = rawBusy
    .filter((b): b is { start: string; end: string } => Boolean(b.start && b.end))
    .map((b) => ({ start: b.start!, end: b.end! }));

  return {
    busy,
    rangeStart: timeMin,
    rangeEnd: timeMax
  };
}

const VIEWING_SLOT_STEP_MS = 15 * 60 * 1000;
const DEFAULT_VIEWING_SLOT_MINUTES = 60;

function clampViewingSlotMinutes(minutes: number): number {
  const stepped = Math.round(minutes / 15) * 15;
  return Math.max(15, Math.min(480, stepped));
}

function alignViewingSearchCursor(now: Date): Date {
  const roundedUp = new Date(Math.ceil(now.getTime() / VIEWING_SLOT_STEP_MS) * VIEWING_SLOT_STEP_MS);
  const nineToday = new Date(now);
  nineToday.setHours(9, 0, 0, 0);
  const c = new Date(Math.max(roundedUp.getTime(), nineToday.getTime()));
  let guard = 0;
  while ((c.getDay() === 0 || c.getDay() === 6) && guard < 14) {
    c.setDate(c.getDate() + 1);
    c.setHours(9, 0, 0, 0);
    guard++;
  }
  return c;
}

function jumpCursorToNextWeekdayNine(cursor: Date): void {
  cursor.setDate(cursor.getDate() + 1);
  cursor.setHours(9, 0, 0, 0);
  let guard = 0;
  while ((cursor.getDay() === 0 || cursor.getDay() === 6) && guard < 14) {
    cursor.setDate(cursor.getDate() + 1);
    guard++;
  }
}

/**
 * Z výsledku prohlížení kalendáře spočítá sloty pro prohlídku (pracovní dny, začátky po 15 min, konec nejpozději v 17:00).
 */
export function buildViewingSlotsFromCalendarAvailability(
  availability: CalendarAvailabilityResult,
  params: { limit?: number; now?: Date; slotDurationMinutes?: number }
): CalendarTimeRange[] {
  const now = params.now ?? new Date();
  const maxResults = params.limit ?? 5;
  const slotMs = clampViewingSlotMinutes(params.slotDurationMinutes ?? DEFAULT_VIEWING_SLOT_MINUTES) * 60 * 1000;
  const { busy } = availability;
  const timeMax = new Date(availability.rangeEnd).getTime();

  const slots: CalendarTimeRange[] = [];
  const cursor = alignViewingSearchCursor(now);

  let iter = 0;
  const maxIter = 25_000;

  while (slots.length < maxResults && cursor.getTime() < timeMax && iter < maxIter) {
    iter++;
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      jumpCursorToNextWeekdayNine(cursor);
      continue;
    }
    if (cursor.getHours() < 9) {
      cursor.setHours(9, 0, 0, 0);
      continue;
    }

    const start = new Date(cursor);
    const end = new Date(start.getTime() + slotMs);
    const workEnd = new Date(start);
    workEnd.setHours(17, 0, 0, 0);

    if (end.getTime() > workEnd.getTime()) {
      jumpCursorToNextWeekdayNine(cursor);
      continue;
    }

    const overlap = busy.some((item) => {
      const busyStart = new Date(item.start);
      const busyEnd = new Date(item.end);
      return rangesOverlap(start, end, busyStart, busyEnd);
    });

    if (!overlap) {
      slots.push({ start: start.toISOString(), end: end.toISOString() });
      cursor.setTime(end.getTime());
      cursor.setTime(Math.ceil(cursor.getTime() / VIEWING_SLOT_STEP_MS) * VIEWING_SLOT_STEP_MS);
    } else {
      cursor.setTime(cursor.getTime() + VIEWING_SLOT_STEP_MS);
    }
  }

  return slots;
}

export type CalendarEventListItem = {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
};

/**
 * Události v kalendáři uživatele (Google nebo Microsoft podle calendar_provider).
 */
export async function listUserCalendarEvents(params: {
  userId: string;
  timeMin: string;
  timeMax: string;
}): Promise<{ events: CalendarEventListItem[]; provider: "google" | "microsoft" }> {
  const settings = await fetchUserIntegrationSettings(params.userId);
  const calendarProvider = settings?.calendar_provider ?? "google";

  if (calendarProvider === "microsoft") {
    const events = await listMicrosoftCalendarEvents({
      userId: params.userId,
      timeMin: params.timeMin,
      timeMax: params.timeMax
    });
    return { events, provider: "microsoft" };
  }

  const { auth, calendarId } = await getGoogleAuthForUser({
    userId: params.userId,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
  });
  const calendar = google.calendar({ version: "v3", auth });
  const res = await calendar.events.list({
    calendarId,
    timeMin: params.timeMin,
    timeMax: params.timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50
  });

  const events: CalendarEventListItem[] = (res.data.items ?? [])
    .filter((e) => e.id && (e.start?.dateTime || e.start?.date))
    .map((e) => ({
      id: e.id!,
      summary: e.summary ?? "(Bez názvu)",
      start: e.start?.dateTime ?? e.start?.date ?? "",
      end: e.end?.dateTime ?? e.end?.date ?? "",
      htmlLink: e.htmlLink ?? undefined
    }));

  return { events, provider: "google" };
}

export async function suggestViewingSlots(params: {
  userId: string;
  daysAhead?: number;
  limit?: number;
  slotDurationMinutes?: number;
}): Promise<ViewingSlotsResult> {
  const availability = await browseCalendarAvailability({
    userId: params.userId,
    daysAhead: params.daysAhead
  });
  const slots = buildViewingSlotsFromCalendarAvailability(availability, {
    limit: params.limit,
    slotDurationMinutes: params.slotDurationMinutes
  });
  return {
    ...availability,
    slots
  };
}
