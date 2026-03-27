import { describe, expect, it, vi, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { generateReportArtifacts } from "@/lib/agent/tools/report-tool";

const uploadMock = vi.fn();
const getBucketMock = vi.fn();

vi.mock("@/lib/config/env", () => ({
  getEnv: () => ({ SUPABASE_STORAGE_BUCKET: "test-bucket" })
}));

vi.mock("@/lib/supabase/server-client", () => ({
  getSupabaseAdminClient: () => ({
    storage: {
      getBucket: getBucketMock,
      from: () => ({
        upload: uploadMock,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://example.test/storage/${path}` }
        })
      })
    }
  })
}));

beforeEach(() => {
  vi.clearAllMocks();
  getBucketMock.mockResolvedValue({ data: {}, error: null });
  uploadMock.mockResolvedValue({ data: {}, error: null });
});

async function xlsxBlobFromUploads(): Promise<Blob> {
  const xlsxCall = uploadMock.mock.calls.find((c) => typeof c[0] === "string" && c[0].endsWith("report.xlsx"));
  expect(xlsxCall).toBeDefined();
  return xlsxCall![1] as Blob;
}

describe("generateReportArtifacts", () => {
  it("uploads CSV, Markdown and XLSX and returns public URLs", async () => {
    const out = await generateReportArtifacts({
      runId: "run-abc",
      title: "Test report",
      rows: [{ a: 1, b: "x" }]
    });

    expect(out.csvPublic).toContain("dataset.csv");
    expect(out.mdPublic).toContain("summary.md");
    expect(out.xlsxPublic).toContain("report.xlsx");
    expect(uploadMock).toHaveBeenCalledTimes(3);
  });

  it("builds Data sheet from main rows and extra sheets with correct headers", async () => {
    await generateReportArtifacts({
      runId: "run-xlsx",
      title: "Multi",
      rows: [{ metric: "m", value: 10 }],
      extraSheets: [
        { name: "Properties", rows: [{ id: "p1", city: "Praha" }] },
        { name: "Leads", rows: [{ id: "l1", status: "new" }] }
      ]
    });

    const blob = await xlsxBlobFromUploads();
    const wb = new ExcelJS.Workbook();
    // exceljs typings vs TS 5.7+ Buffer — force through for test readback only.
    await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()) as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);

    const names = wb.worksheets.map((w) => w.name).sort();
    expect(names).toEqual(["Data", "Leads", "Properties"].sort());

    const data = wb.getWorksheet("Data")!;
    expect(data.getRow(1).values).toEqual([, "metric", "value"]);
    expect(data.getRow(2).values).toEqual([, "m", 10]);

    const props = wb.getWorksheet("Properties")!;
    expect(props.getRow(1).values).toEqual([, "id", "city"]);
    expect(props.getRow(2).values).toEqual([, "p1", "Praha"]);
  });

  it("handles empty main rows without throwing", async () => {
    await expect(
      generateReportArtifacts({
        runId: "run-empty",
        title: "Empty",
        rows: []
      })
    ).resolves.toMatchObject({
      csvPublic: expect.stringContaining("dataset.csv"),
      xlsxPublic: expect.stringContaining("report.xlsx")
    });

    const blob = await xlsxBlobFromUploads();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await blob.arrayBuffer()) as unknown as Parameters<ExcelJS.Xlsx["load"]>[0]);
    const data = wb.getWorksheet("Data")!;
    expect(String(data.getCell("A1").value)).toContain("žádné");
  });
});
