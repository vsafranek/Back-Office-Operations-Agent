import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generatePptxFromBlueWhiteTemplate } from "@/lib/agent/tools/presentation-from-template";

const templatePath = path.join(
  process.cwd(),
  "assets",
  "presentation-templates",
  "blue-white-company-profile.pptx"
);
const templateOnDisk = fs.existsSync(templatePath);

describe("generatePptxFromBlueWhiteTemplate", () => {
  it.skipIf(!templateOnDisk)(
    "writes a non-empty pptx from repo template and sample slides",
    async () => {
      const buf = await generatePptxFixture(templatePath);
      expect(buf.byteLength).toBeGreaterThan(500_000);
    },
    120_000
  );
});

/** Single entry point so the test body stays readable. */
async function generatePptxFixture(templatePath: string) {
  return generatePptxFromBlueWhiteTemplate({
    templatePath,
    titleSlideIndex: 1,
    contentSlideIndex: 13,
    deckTitle: "Vitest — prezentace",
    deckSubtitle: "Automatický test",
    deckTagline: "Overeni generovani z blue-white sablony.",
    slides: [
      {
        title: "Kratky titulek",
        bullets: [
          "Prvni bod s daty a strucnym komentarem.",
          "Druhy bod — trendy a srovnani.",
          "Treti bod — rizika.",
          "Ctvrty bod — doporuceni pro vedeni."
        ]
      },
      {
        title: "Druhy slide",
        bullets: ["A", "B", "C", "D"].map((x) => `Bod ${x}: ukazkova odrázka pro ${x}.`)
      }
    ]
  });
}
