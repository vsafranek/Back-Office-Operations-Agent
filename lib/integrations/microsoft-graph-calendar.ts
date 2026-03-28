import { fetchUserIntegrationSettings } from "@/lib/integrations/user-integration-settings";
import { getMicrosoftAccessTokenForUser } from "@/lib/integrations/microsoft-user-auth";

export type CalendarTimeRange = { start: string; end: string };

export type CalendarAvailabilityResult = {
  busy: CalendarTimeRange[];
  rangeStart: string;
  rangeEnd: string;
};

type GraphScheduleItem = {
  status?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
};

type GraphGetScheduleResponse = {
  value?: Array<{
    scheduleId?: string;
    scheduleItems?: GraphScheduleItem[];
    error?: { message?: string };
  }>;
};

async function graphFetchJson<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Microsoft Graph ${path} failed (${res.status}): ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as T;
}

async function resolveScheduleAddress(params: {
  userId: string;
  accessToken: string;
}): Promise<string> {
  const row = await fetchUserIntegrationSettings(params.userId);
  const fromSettings = row?.calendar_account_email?.trim() || row?.mail_from_email?.trim();
  if (fromSettings) return fromSettings;

  const me = await graphFetchJson<{ mail?: string; userPrincipalName?: string }>(
    params.accessToken,
    "/me?$select=mail,userPrincipalName"
  );
  const addr = me.mail?.trim() || me.userPrincipalName?.trim();
  if (!addr) {
    throw new Error("Microsoft Graph: nelze zjistit e-mail uživatele pro kalendář (zkuste vyplnit v nastavení).");
  }
  return addr;
}

/**
 * Outlook / Microsoft 365 kalendář — obsazenost přes getSchedule (stejná idea jako Google free/busy).
 */
export async function browseMicrosoftCalendarAvailability(params: {
  userId: string;
  daysAhead?: number;
}): Promise<CalendarAvailabilityResult> {
  const accessToken = await getMicrosoftAccessTokenForUser({ userId: params.userId });
  const scheduleId = await resolveScheduleAddress({ userId: params.userId, accessToken });

  const now = new Date();
  const daysAhead = params.daysAhead ?? 7;
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const body = {
    schedules: [scheduleId],
    startTime: { dateTime: timeMin, timeZone: "UTC" },
    endTime: { dateTime: timeMax, timeZone: "UTC" },
    availabilityViewInterval: 30
  };

  const data = await graphFetchJson<GraphGetScheduleResponse>(accessToken, "/me/calendar/getSchedule", {
    method: "POST",
    body: JSON.stringify(body)
  });

  const first = data.value?.[0];
  if (first?.error?.message) {
    throw new Error(`Microsoft calendar: ${first.error.message}`);
  }

  const items = first?.scheduleItems ?? [];
  const busy: CalendarTimeRange[] = [];
  for (const item of items) {
    if (item.status !== "busy" && item.status !== "oof" && item.status !== "workingElsewhere") continue;
    const start = item.start?.dateTime;
    const end = item.end?.dateTime;
    if (start && end) {
      busy.push({ start, end });
    }
  }

  return {
    busy,
    rangeStart: timeMin,
    rangeEnd: timeMax
  };
}
