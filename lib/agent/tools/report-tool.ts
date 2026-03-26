import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export async function generateReportArtifacts(params: {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
}) {
  const env = getEnv();
  const supabase = getSupabaseAdminClient();
  const bucketName = env.SUPABASE_STORAGE_BUCKET;

  const bucketCheck = await supabase.storage.getBucket(bucketName);
  if (bucketCheck.error) {
    const createBucket = await supabase.storage.createBucket(bucketName, {
      public: true
    });
    if (createBucket.error) {
      throw new Error(`Storage bucket init failed: ${createBucket.error.message}`);
    }
  }

  const csvHeader = params.rows.length > 0 ? Object.keys(params.rows[0]) : [];
  const csvBody = params.rows
    .map((row) => csvHeader.map((key) => JSON.stringify(row[key] ?? "")).join(","))
    .join("\n");
  const csv = `${csvHeader.join(",")}\n${csvBody}`;

  const markdown = `# ${params.title}

Run ID: ${params.runId}

Rows: ${params.rows.length}
`;

  const csvPath = `reports/${params.runId}/dataset.csv`;
  const mdPath = `reports/${params.runId}/summary.md`;

  const csvUpload = await supabase.storage
    .from(bucketName)
    .upload(csvPath, new Blob([csv], { type: "text/csv" }), { upsert: true });

  if (csvUpload.error) {
    throw new Error(`CSV upload failed: ${csvUpload.error.message}`);
  }

  const mdUpload = await supabase.storage
    .from(bucketName)
    .upload(mdPath, new Blob([markdown], { type: "text/markdown" }), { upsert: true });

  if (mdUpload.error) {
    throw new Error(`Markdown upload failed: ${mdUpload.error.message}`);
  }

  const csvPublic = supabase.storage.from(bucketName).getPublicUrl(csvPath).data.publicUrl;
  const mdPublic = supabase.storage.from(bucketName).getPublicUrl(mdPath).data.publicUrl;

  return {
    csvPublic,
    mdPublic
  };
}
