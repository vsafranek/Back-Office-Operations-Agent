import { runWeeklyExecutiveReport } from "@/workflows/weekly-exec-report";
import { z } from "zod";

export const runtime = "nodejs";

const requestSchema = z.object({
  slideCount: z.coerce.number().int().min(1).max(14).optional(),
  title: z.string().min(3).max(120).optional(),
  context: z.string().min(3).max(2000).optional()
});

export async function POST(request: Request) {
  const raw = await request.text();
  const body = raw.trim() ? requestSchema.parse(JSON.parse(raw)) : {};
  const result = await runWeeklyExecutiveReport(body);
  return Response.json(result);
}
