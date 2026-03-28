import { describe, expect, it } from "vitest";
import { serializeForTrace } from "@/lib/agent/trace/serialize-for-trace";

describe("serializeForTrace", () => {
  it("redacts sensitive keys", () => {
    const out = serializeForTrace({ password: "secret", name: "ok" }) as Record<string, unknown>;
    expect(out.password).toBe("[REDACTED]");
    expect(out.name).toBe("ok");
  });

  it("masks email when field key suggests email", () => {
    const out = serializeForTrace({ to_email: "client@example.com" }) as Record<string, unknown>;
    expect(out.to_email).toContain("@example.com");
    expect(out.to_email).not.toBe("client@example.com");
  });
});
