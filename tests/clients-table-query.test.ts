import { describe, expect, it } from "vitest";
import { sanitizeClientSearchFragment } from "@/lib/agent/tools/clients-table-query";

describe("sanitizeClientSearchFragment", () => {
  it("odstraní znaky lámající PostgREST OR a LIKE", () => {
    expect(sanitizeClientSearchFragment("a%,b*")).toBe("a b");
  });

  it("zkrátí délku", () => {
    const long = "x".repeat(200);
    expect(sanitizeClientSearchFragment(long).length).toBeLessThanOrEqual(160);
  });
});
