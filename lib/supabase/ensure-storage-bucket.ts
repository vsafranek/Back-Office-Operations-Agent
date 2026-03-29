import type { SupabaseClient } from "@supabase/supabase-js";

/** Supabase někdy vrátí chybu i když bucket už existuje; createBucket pak hlásí „resource already exists“. */
export function isStorageBucketAlreadyExistsError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("already exists") || m.includes("duplicate") || m.includes("409") || m.includes("23505")
  );
}

/**
 * Zajistí existenci veřejného bucketu. `getBucket` může selhat i při existujícím bucketu (RLS/API);
 * v takovém případě ignorujeme chybu create, pokud znamená „už existuje“.
 */
export async function ensurePublicStorageBucket(
  supabase: SupabaseClient,
  bucketName: string
): Promise<void> {
  const bucketCheck = await supabase.storage.getBucket(bucketName);
  if (!bucketCheck.error) return;

  const created = await supabase.storage.createBucket(bucketName, { public: true });
  if (created.error && !isStorageBucketAlreadyExistsError(created.error.message)) {
    throw new Error(`Storage bucket init failed: ${created.error.message}`);
  }
}
