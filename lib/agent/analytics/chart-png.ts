import "server-only";

import sharp from "sharp";
import { buildBarChartSvg, type BarChartModel } from "@/lib/agent/analytics/chart-png-svg";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type { BarChartModel } from "@/lib/agent/analytics/chart-png-svg";

export async function svgToPngBuffer(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg, "utf-8"), { density: 144 }).png().toBuffer();
}

/**
 * Nahraje PNG grafu Q1 podle kanálu do Supabase Storage; vrátí veřejnou URL nebo null při prázdných datech / chybě renderu.
 */
export async function persistQ1SourceChannelChartPng(params: {
  runId: string;
  chart: BarChartModel;
}): Promise<string | null> {
  if (params.chart.labels.length === 0) return null;

  let png: Buffer;
  try {
    const svg = buildBarChartSvg(params.chart);
    png = await svgToPngBuffer(svg);
  } catch {
    return null;
  }

  const env = getEnv();
  const supabase = getSupabaseAdminClient();
  const bucketName = env.SUPABASE_STORAGE_BUCKET;

  const bucketCheck = await supabase.storage.getBucket(bucketName);
  if (bucketCheck.error) {
    const createBucket = await supabase.storage.createBucket(bucketName, { public: true });
    if (createBucket.error) {
      throw new Error(`Storage bucket init failed: ${createBucket.error.message}`);
    }
  }

  const objectPath = `reports/${params.runId}/q1-source-channel.png`;
  const upload = await supabase.storage.from(bucketName).upload(objectPath, png, {
    upsert: true,
    contentType: "image/png",
    cacheControl: "3600"
  });

  if (upload.error) {
    throw new Error(`Chart PNG upload failed: ${upload.error.message}`);
  }

  return supabase.storage.from(bucketName).getPublicUrl(objectPath).data.publicUrl;
}
