import "server-only";

import sharp from "sharp";
import { buildBarChartSvg, buildDerivedChartSvg, type BarChartModel } from "@/lib/agent/analytics/chart-png-svg";
import type { DerivedChartModel } from "@/lib/agent/types";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";
import { ensurePublicStorageBucket } from "@/lib/supabase/ensure-storage-bucket";

export type { BarChartModel } from "@/lib/agent/analytics/chart-png-svg";

export async function svgToPngBuffer(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg, "utf-8"), { density: 144 }).png().toBuffer();
}

async function uploadPng(runId: string, objectPath: string, png: Buffer): Promise<string> {
  const env = getEnv();
  const supabase = getSupabaseAdminClient();
  const bucketName = env.SUPABASE_STORAGE_BUCKET;

  await ensurePublicStorageBucket(supabase, bucketName);

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

/** Nahraje PNG odvozeného grafu (bar | line | pie) podle `chart.kind`. */
export async function persistDerivedChartPng(params: {
  runId: string;
  chart: DerivedChartModel;
  fileSuffix: string;
}): Promise<string | null> {
  if (params.chart.labels.length === 0) return null;

  let png: Buffer;
  try {
    const svg = buildDerivedChartSvg(params.chart);
    png = await svgToPngBuffer(svg);
  } catch {
    return null;
  }

  const safe = params.fileSuffix.replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 80);
  const objectPath = `reports/${params.runId}/derived-${safe}.png`;
  return uploadPng(params.runId, objectPath, png);
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

  await ensurePublicStorageBucket(supabase, bucketName);

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
