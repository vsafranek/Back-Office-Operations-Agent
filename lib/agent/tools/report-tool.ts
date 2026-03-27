import ExcelJS from "exceljs";
import { getEnv } from "@/lib/config/env";
import { getSupabaseAdminClient } from "@/lib/supabase/server-client";

export type ReportExtraSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, "_").trim();
  const base = cleaned.slice(0, 31);
  return base.length > 0 ? base : "Sheet";
}

function cellValue(v: unknown): ExcelJS.CellValue {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (v instanceof Date) return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function appendRowsToSheet(ws: ExcelJS.Worksheet, rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    ws.addRow(["(žádné řádky)"]);
    return;
  }
  const headers = Object.keys(rows[0]!);
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(headers.map((h) => cellValue(row[h])));
  }
}

function usedSheetNames(names: Set<string>, desired: string): string {
  let name = sanitizeSheetName(desired);
  let n = 1;
  while (names.has(name)) {
    const suffix = `_${n}`;
    name = sanitizeSheetName(desired).slice(0, Math.max(1, 31 - suffix.length)) + suffix;
    n += 1;
  }
  names.add(name);
  return name;
}

export async function generateReportArtifacts(params: {
  runId: string;
  title: string;
  rows: Record<string, unknown>[];
  /** Další listy (.xlsx), např. Properties + Leads pro CRM export. */
  extraSheets?: ReportExtraSheet[];
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

  const csvHeader = params.rows.length > 0 ? Object.keys(params.rows[0]!) : [];
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
  const xlsxPath = `reports/${params.runId}/report.xlsx`;

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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Back Office Agent";
  const names = new Set<string>();
  const mainName = usedSheetNames(names, "Data");
  appendRowsToSheet(workbook.addWorksheet(mainName), params.rows);

  for (const sheet of params.extraSheets ?? []) {
    const sn = usedSheetNames(names, sheet.name);
    appendRowsToSheet(workbook.addWorksheet(sn), sheet.rows);
  }

  const xlsxBuffer = await workbook.xlsx.writeBuffer();
  const xlsxUpload = await supabase.storage
    .from(bucketName)
    .upload(
      xlsxPath,
      new Blob([xlsxBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      }),
      { upsert: true, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
    );

  if (xlsxUpload.error) {
    throw new Error(`XLSX upload failed: ${xlsxUpload.error.message}`);
  }

  const csvPublic = supabase.storage.from(bucketName).getPublicUrl(csvPath).data.publicUrl;
  const mdPublic = supabase.storage.from(bucketName).getPublicUrl(mdPath).data.publicUrl;
  const xlsxPublic = supabase.storage.from(bucketName).getPublicUrl(xlsxPath).data.publicUrl;

  return {
    csvPublic,
    mdPublic,
    xlsxPublic
  };
}
