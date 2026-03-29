import fs from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

describe("presentation PDF Noto + pdf-lib (Unicode)", () => {
  it("kreslí češtinu bez WinAnsi (např. ň)", async () => {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const bytes = new Uint8Array(
      fs.readFileSync(path.join(process.cwd(), "assets", "fonts", "NotoSans-Regular.ttf"))
    );
    const font = await pdf.embedFont(bytes, { subset: true });
    const page = pdf.addPage([400, 200]);
    page.drawText("Shrnutí pro vedení — hoď koně přes něž chňapá ďábel.", {
      x: 12,
      y: 160,
      size: 11,
      font
    });
    const out = await pdf.save();
    expect(out.byteLength).toBeGreaterThan(2_000);
  });
});
