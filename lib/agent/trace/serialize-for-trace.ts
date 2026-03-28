const MAX_STRING = 12_000;
const MAX_ROWS_PREVIEW = 8;

const SENSITIVE_KEY_SUBSTRINGS = [
  "password",
  "token",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "refresh_token",
  "access_token",
  "private_key",
  "client_secret"
];

const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function serializeForTrace(value: unknown): unknown {
  return trimValue(value, 0, "");
}

function shouldRedactKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_SUBSTRINGS.some((s) => lower.includes(s));
}

function shouldMaskEmailFieldKey(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("email") || lower.includes("mail") || lower === "to" || lower === "from";
}

function maskEmailLike(s: string): string {
  const at = s.indexOf("@");
  if (at <= 1) return "[email]";
  return `${s.slice(0, 2)}…@${s.slice(at + 1)}`;
}

function trimValue(value: unknown, depth: number, keyHint: string): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    let s = value.length <= MAX_STRING ? value : `${value.slice(0, MAX_STRING)}… (${value.length} chars)`;
    if (shouldMaskEmailFieldKey(keyHint) && EMAIL_LIKE.test(s.trim())) {
      s = maskEmailLike(s.trim());
    }
    return s;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth > 6) return "[depth-limit]";

  if (Array.isArray(value)) {
    if (value.length > 0 && isRecordRow(value[0])) {
      return {
        _type: "rows",
        length: value.length,
        columns: guessColumns(value[0] as Record<string, unknown>),
        preview: value.slice(0, MAX_ROWS_PREVIEW).map((r) => trimValue(r, depth + 1, ""))
      };
    }
    return value.slice(0, 50).map((v) => trimValue(v, depth + 1, ""));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    const keys = Object.keys(obj).slice(0, 40);
    for (const k of keys) {
      if (shouldRedactKey(k)) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = trimValue(obj[k], depth + 1, k);
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
