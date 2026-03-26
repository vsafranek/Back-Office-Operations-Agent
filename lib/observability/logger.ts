type LogLevel = "info" | "warn" | "error";

type LogPayload = Record<string, unknown>;

const SENSITIVE_KEYS = ["email", "apiKey", "authorization", "body", "token", "privateKey"];

function redact(value: unknown): unknown {
  if (typeof value === "string") {
    if (value.length <= 8) return "***";
    return `${value.slice(0, 2)}***${value.slice(-2)}`;
  }
  return "***";
}

function sanitizePayload(payload: LogPayload | undefined): LogPayload | undefined {
  if (!payload) return undefined;
  const safePayload: LogPayload = {};
  for (const [key, value] of Object.entries(payload)) {
    if (SENSITIVE_KEYS.some((sensitiveKey) => key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
      safePayload[key] = redact(value);
      continue;
    }
    safePayload[key] = value;
  }
  return safePayload;
}

function write(level: LogLevel, message: string, payload?: LogPayload): void {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizePayload(payload)
  };

  // Structured log output for Vercel log drains / SIEM.
  console[level](JSON.stringify(entry));
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    write("info", message, payload);
  },
  warn(message: string, payload?: LogPayload) {
    write("warn", message, payload);
  },
  error(message: string, payload?: LogPayload) {
    write("error", message, payload);
  }
};
