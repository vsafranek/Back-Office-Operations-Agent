import { google } from "googleapis";
import { getGoogleAuthForUser } from "@/lib/integrations/google-user-auth";
import { browseMicrosoftCalendarAvailability } from "@/lib/integrations/microsoft-graph-calendar";
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

/**
 * Z výsledku prohlížení kalendáře spočítá hodinové sloty pro prohlídku (pracovní dny 9–17).
 */
export function buildViewingSlotsFromCalendarAvailability(
  availability: CalendarAvailabilityResult,
  params: { limit?: number; now?: Date }
): CalendarTimeRange[] {
  const now = params.now ?? new Date();
  const maxResults = params.limit ?? 5;
  const { busy } = availability;
  const timeMax = availability.rangeEnd;

  const slots: CalendarTimeRange[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(9, 0, 0, 0);

  while (slots.length < maxResults && cursor.toISOString() < timeMax) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + 60 * 60 * 1000);
    const overlap = busy.some((item) => {
      const busyStart = new Date(item.start);
      const busyEnd = new Date(item.end);
      return rangesOverlap(start, end, busyStart, busyEnd);
    });
    if (!overlap && start.getDay() > 0 && start.getDay() < 6 && start.getHours() >= 9 && start.getHours() <= 17) {
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}

export async function suggestViewingSlots(params: {
  userId: string;
  daysAhead?: number;
  limit?: number;
}): Promise<ViewingSlotsResult> {
  const availability = await browseCalendarAvailability({
    userId: params.userId,
    daysAhead: params.daysAhead
  });
  const slots = buildViewingSlotsFromCalendarAvailability(availability, { limit: params.limit });
  return {
    ...availability,
    slots
  };
}
