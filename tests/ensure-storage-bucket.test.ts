import { describe, expect, it, vi } from "vitest";
import { ensurePublicStorageBucket, isStorageBucketAlreadyExistsError } from "@/lib/supabase/ensure-storage-bucket";

describe("ensurePublicStorageBucket", () => {
  it("ignores createBucket error when bucket already exists", async () => {
    const createBucket = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "The resource already exists" }
    });
    const supabase = {
      storage: {
        getBucket: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
        createBucket
      }
    };
    await expect(ensurePublicStorageBucket(supabase as never, "my-bucket")).resolves.toBeUndefined();
    expect(createBucket).toHaveBeenCalledTimes(1);
  });

  it("throws on unexpected createBucket error", async () => {
    const supabase = {
      storage: {
        getBucket: vi.fn().mockResolvedValue({ data: null, error: { message: "nope" } }),
        createBucket: vi.fn().mockResolvedValue({ data: null, error: { message: "permission denied" } })
      }
    };
    await expect(ensurePublicStorageBucket(supabase as never, "x")).rejects.toThrow("Storage bucket init failed");
  });
});

describe("isStorageBucketAlreadyExistsError", () => {
  it("detects Supabase duplicate message", () => {
    expect(isStorageBucketAlreadyExistsError("The resource already exists")).toBe(true);
  });
});
