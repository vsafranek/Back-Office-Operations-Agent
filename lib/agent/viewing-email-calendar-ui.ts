import type { AgentDataPanel } from "@/lib/agent/types";

export const VIEWING_MEET_DURATION_MIN_MIN = 15;
export const VIEWING_MEET_DURATION_MAX_MIN = 480;

export function clampViewingMeetDurationMinutes(minutes: number): number {
  const stepped = Math.round(minutes / 15) * 15;
  return Math.max(VIEWING_MEET_DURATION_MIN_MIN, Math.min(VIEWING_MEET_DURATION_MAX_MIN, stepped));
}

export function viewingSlotDurationMs(slots: { start: string; end: string }[]): number {
  const s0 = slots[0];
  if (!s0) return 60 * 60 * 1000;
  const a = new Date(s0.start).getTime();
  const b = new Date(s0.end).getTime();
  const d = b - a;
  return Number.isFinite(d) && d >= 15 * 60 * 1000 ? d : 60 * 60 * 1000;
}

export type ViewingEmailPreviewRange = {
  busy: { start: string; end: string }[];
  rangeStart: string;
  rangeEnd: string;
};

type ViewingDraftPanel = Extract<AgentDataPanel, { kind: "viewing_email_draft" }>;

export function buildViewingEmailPreviewRange(panel: ViewingDraftPanel | null): ViewingEmailPreviewRange | null {
  if (!panel) return null;
  const { calendarPreview, slots } = panel;
  if (calendarPreview?.rangeStart && calendarPreview?.rangeEnd) {
    return {
      busy: calendarPreview.busy ?? [],
      rangeStart: calendarPreview.rangeStart,
      rangeEnd: calendarPreview.rangeEnd
    };
  }
  if (slots.length === 0) return null;
  const starts = slots.map((s) => new Date(s.start).getTime()).filter((t) => !Number.isNaN(t));
  const ends = slots.map((s) => new Date(s.end).getTime()).filter((t) => !Number.isNaN(t));
  if (starts.length === 0 || ends.length === 0) return null;
  return {
    busy: [],
    rangeStart: new Date(Math.min(...starts)).toISOString(),
    rangeEnd: new Date(Math.max(...ends)).toISOString()
  };
}
