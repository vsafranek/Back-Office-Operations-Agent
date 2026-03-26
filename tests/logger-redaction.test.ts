import { describe, expect, it, vi } from "vitest";
import { logger } from "../lib/observability/logger";

describe("logger redaction", () => {
  it("redacts sensitive keys", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    logger.info("test", {
      email: "john@example.com",
      apiKey: "super-secret-key",
      safeValue: "ok"
    });

    const payload = spy.mock.calls[0]?.[0] as string;
    expect(payload).toContain("\"email\":\"jo***om\"");
    expect(payload).toContain("\"apiKey\":\"su***ey\"");
    expect(payload).toContain("\"safeValue\":\"ok\"");

    spy.mockRestore();
  });
});
