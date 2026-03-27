import fs from "fs";
import os from "os";
import path from "path";
import Automizer, { modify } from "pptx-automizer";

export type PresentationTemplateSlideSpec = {
  title: string;
  bullets: string[];
};

export type GenerateFromTemplateParams = {
  templatePath: string;
  /** 1-based index in source deck. */
  titleSlideIndex: number;
  /** 1-based index in source deck. */
  contentSlideIndex: number;
  deckTitle: string;
  deckSubtitle: string;
  deckTagline: string;
  slides: PresentationTemplateSlideSpec[];
};

const TEMPLATE_ALIAS = "boa-blue-white";

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** Builds a branded PPTX from the blue-white template (pptx-automizer). */
export async function generatePptxFromBlueWhiteTemplate(params: GenerateFromTemplateParams): Promise<Buffer> {
  const buf = fs.readFileSync(params.templatePath);
  const templateDir = `${path.dirname(params.templatePath)}${path.sep}`;
  const automizer = new Automizer({
    templateDir,
    templateFallbackDir: templateDir,
    outputDir: `${os.tmpdir()}${path.sep}`,
    removeExistingSlides: true,
    autoImportSlideMasters: true,
    compression: 0,
    verbosity: 0
  });

  automizer.loadRoot(buf).load(buf, TEMPLATE_ALIAS);
  await automizer.presentation();

  if (params.titleSlideIndex > 0) {
    automizer.addSlide(TEMPLATE_ALIAS, params.titleSlideIndex, (slide) => {
      slide.modifyElement(
        "TextBox 3",
        modify.replaceText([{ replace: "BOA_DECK_TITLE", by: { text: params.deckTitle } }])
      );
      slide.modifyElement(
        "TextBox 7",
        modify.replaceText([{ replace: "BOA_DECK_SUBTITLE", by: { text: params.deckSubtitle } }])
      );
      slide.modifyElement(
        "TextBox 8",
        modify.replaceText([{ replace: "BOA_DECK_TAGLINE", by: { text: params.deckTagline } }])
      );
    });
  }

  for (const spec of params.slides) {
    automizer.addSlide(TEMPLATE_ALIAS, params.contentSlideIndex, (slide) => {
      slide.modifyElement("TextBox 3", modify.replaceText([{ replace: "BOA_TITLE", by: { text: spec.title } }]));
      slide.modifyElement(
        "TextBox 4",
        modify.replaceText([{ replace: "BOA_BULLETS", by: { text: spec.bullets.join("\n") } }])
      );
    });
  }

  const stream = await automizer.stream({ type: "nodebuffer", compression: "STORE", streamFiles: true });
  return streamToBuffer(stream);
}
