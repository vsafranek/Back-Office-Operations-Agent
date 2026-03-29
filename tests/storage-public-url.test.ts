import { describe, expect, it } from "vitest";
import { storageFolderPrefixFromFilePublicUrl, storageObjectPathFromPublicUrl } from "@/lib/ui/storage-public-url";

describe("storage-public-url", () => {
  it("parsuje veřejnou Supabase cestu k objektu", () => {
    const url =
      "https://abc.supabase.co/storage/v1/object/public/my-bucket/reports/prezentace/foo-bar-xyz/prezentace-boa.pptx";
    expect(storageObjectPathFromPublicUrl(url)).toBe("reports/prezentace/foo-bar-xyz/prezentace-boa.pptx");
    expect(storageFolderPrefixFromFilePublicUrl(url)).toBe("reports/prezentace/foo-bar-xyz");
  });
});
