const MAX_STRING = 12_000;
const MAX_ROWS_PREVIEW = 8;

export function serializeForTrace(value: unknown): unknown {
  return trimValue(value, 0);
}

function trimValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length <= MAX_STRING ? value : `${value.slice(0, MAX_STRING)}… (${value.length} chars)`;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 6) return "[depth-limit]";

  if (Array.isArray(value)) {
    if (value.length > 0 && isRecordRow(value[0])) {
      return {
        _type: "rows",
        length: value.length,
        columns: guessColumns(value[0] as Record<string, unknown>),
        preview: value.slice(0, MAX_ROWS_PREVIEW).map((r) => trimValue(r, depth + 1))
      };
    }
    return value.slice(0, 50).map((v) => trimValue(v, depth + 1));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).slice(0, 40);
    for (const k of keys) {
      out[k] = trimValue(obj[k], depth + 1);
    }
    return out;
  }

  return String(value);
}

function isRecordRow(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function guessColumns(row: Record<string, unknown>): string[] {
  return Object.keys(row).slice(0, 24);
}
