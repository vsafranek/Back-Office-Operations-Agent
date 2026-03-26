import { google } from "googleapis";
import { getGoogleAuthForUser } from "@/lib/integrations/google-user-auth";

export async function suggestViewingSlots(params: { userId: string; daysAhead?: number; limit?: number }) {
  const { auth, calendarId } = await getGoogleAuthForUser({
    userId: params.userId,
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"]
  });
  const calendar = google.calendar({ version: "v3", auth });

  const now = new Date();
  const daysAhead = params.daysAhead ?? 7;
  const maxResults = params.limit ?? 5;
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const busyResult = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      items: [{ id: calendarId }]
    }
  });

  const busy = busyResult.data.calendars?.[calendarId]?.busy ?? [];
  const slots: { start: string; end: string }[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);
  cursor.setHours(9, 0, 0, 0);

  while (slots.length < maxResults && cursor.toISOString() < timeMax) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + 60 * 60 * 1000);
    const overlap = busy.some((item) => {
      if (!item.start || !item.end) return false;
      const busyStart = new Date(item.start);
      const busyEnd = new Date(item.end);
      return start < busyEnd && end > busyStart;
    });
    if (!overlap && start.getDay() > 0 && start.getDay() < 6 && start.getHours() >= 9 && start.getHours() <= 17) {
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
    cursor.setHours(cursor.getHours() + 1);
  }

  return slots;
}
