import { describe, expect, it } from "vitest";

import { GET as getListings } from "@/app/api/market-listings/route";
import { GET as getListingDetail } from "@/app/api/market-listings/[id]/route";
import { POST as ingest } from "@/app/api/integrations/sreality/ingest/route";
import { GET as getSaved, POST as saveListing } from "@/app/api/saved-listings/route";
import { DELETE as deleteSaved } from "@/app/api/saved-listings/[listingId]/route";

describe("portal-public-map-saved contract", () => {
  it("exposes expected route handlers", async () => {
    expect(typeof getListings).toBe("function");
    expect(typeof getListingDetail).toBe("function");
    expect(typeof ingest).toBe("function");
    expect(typeof getSaved).toBe("function");
    expect(typeof saveListing).toBe("function");
    expect(typeof deleteSaved).toBe("function");
  });
});
