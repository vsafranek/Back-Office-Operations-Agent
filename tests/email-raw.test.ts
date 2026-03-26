import { describe, expect, it } from "vitest";
import { toRawEmail } from "../lib/agent/tools/email-tool";

describe("toRawEmail", () => {
  it("encodes RFC822-like payload for Gmail draft API", () => {
    const raw = toRawEmail({
      to: "john@example.com",
      subject: "Subject",
      body: "Hello world"
    });

    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    expect(decoded).toContain("To: john@example.com");
    expect(decoded).toContain("Subject: Subject");
    expect(decoded).toContain("Hello world");
  });
});
