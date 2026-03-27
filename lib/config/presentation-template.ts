import fs from "fs";
import path from "path";
import type { AppEnv } from "@/lib/config/env";

const DEFAULT_RELATIVE = path.join("assets", "presentation-templates", "blue-white-company-profile.pptx");

function parseTriStateFlag(raw: string | undefined): "auto" | boolean {
  const v = raw?.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return "auto";
}

export type ResolvedPresentationTemplate = {
  resolvedTemplatePath: string;
  useTemplate: boolean;
  contentSlideIndex: number;
  titleSlideIndex: number;
  skipPdf: boolean;
};

export function resolvePresentationTemplate(env: AppEnv): ResolvedPresentationTemplate {
  const rawPath = env.PRESENTATION_TEMPLATE_PATH?.trim();
  const resolvedTemplatePath =
    rawPath && path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath ?? DEFAULT_RELATIVE);

  const flag = parseTriStateFlag(env.PRESENTATION_USE_TEMPLATE);
  const exists = fs.existsSync(resolvedTemplatePath);
  let useTemplate: boolean;
  if (flag === "auto") {
    useTemplate = exists;
  } else if (flag === true) {
    useTemplate = exists;
  } else {
    useTemplate = false;
  }

  return {
    resolvedTemplatePath,
    useTemplate,
    contentSlideIndex: env.PRESENTATION_TEMPLATE_CONTENT_SLIDE_INDEX,
    titleSlideIndex: env.PRESENTATION_TEMPLATE_TITLE_SLIDE_INDEX,
    skipPdf: env.PRESENTATION_SKIP_PDF
  };
}
