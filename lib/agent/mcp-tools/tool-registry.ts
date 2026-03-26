import { z } from "zod";
import { runSqlPreset } from "@/lib/agent/tools/sql-tool";
import { generateReportArtifacts } from "@/lib/agent/tools/report-tool";
import { generatePresentationArtifact, presentationToolContract } from "@/lib/agent/tools/presentation-tool";
import { suggestViewingSlots } from "@/lib/agent/tools/calendar-tool";
import { createEmailDraft } from "@/lib/agent/tools/email-tool";
import { enqueueWorkflowTask } from "@/lib/agent/tools/workflow-tool";
import type { McpTool, ToolAuthMode } from "./types";
import type { AgentToolContext } from "@/lib/agent/types";
import { ToolRunner } from "./tool-runner";

const SqlPresetInputSchema = z.object({
  runId: z.string().min(3),
  question: z.string().min(3)
});

const SqlPresetOutputSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())),
  source: z.string(),
  preset: z.string()
});

const ReportArtifactsInputSchema = z.object({
  runId: z.string().min(3),
  title: z.string().min(3),
  rows: z.array(z.record(z.string(), z.unknown()))
});

const ReportArtifactsOutputSchema = z.object({
  csvPublic: z.string().url(),
  mdPublic: z.string().url()
});

const CalendarSlotsInputSchema = z.object({
  userId: z.string().min(1),
  daysAhead: z.coerce.number().int().optional(),
  limit: z.coerce.number().int().optional()
});

const CalendarSlotsOutputSchema = z.array(
  z.object({
    start: z.string(),
    end: z.string()
  })
);

const EmailDraftInputSchema = z.object({
  userId: z.string().min(1),
  to: z.string().email(),
  subject: z.string().min(3),
  body: z.string().min(1)
});

const EmailDraftOutputSchema = z.object({
  draftId: z.string().nullable().optional(),
  messageId: z.string().nullable().optional()
});

const EnqueueWorkflowTaskInputSchema = z.object({
  endpoint: z.string().min(3),
  payload: z.record(z.string(), z.unknown()).default({})
});

const EnqueueWorkflowTaskOutputSchema = z.any();

const sqlTool: McpTool<z.infer<typeof SqlPresetInputSchema>, z.infer<typeof SqlPresetOutputSchema>> = {
  contract: {
    name: "runSqlPreset",
    description: "Spusti SQL preset (view/function) na zaklade otazky a vrati tabulky pro dalsi analýzu.",
    inputSchema: SqlPresetInputSchema,
    outputSchema: SqlPresetOutputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) => runSqlPreset({ question: input.question, runId: input.runId })
};

const reportTool: McpTool<z.infer<typeof ReportArtifactsInputSchema>, z.infer<typeof ReportArtifactsOutputSchema>> = {
  contract: {
    name: "generateReportArtifacts",
    description: "Vygeneruje CSV dataset a Markdown summary z dat a nahraje je do Supabase Storage.",
    inputSchema: ReportArtifactsInputSchema,
    outputSchema: ReportArtifactsOutputSchema,
    auth: "service-role",
    sideEffects: ["Storage upload (CSV + MD) do bucketu env.SUPABASE_STORAGE_BUCKET"]
  },
  run: async (_ctx: AgentToolContext, input) => generateReportArtifacts({ runId: input.runId, title: input.title, rows: input.rows })
};

const presentationTool: McpTool<
  z.infer<typeof presentationToolContract.inputSchema>,
  z.infer<typeof presentationToolContract.outputSchema>
> = {
  contract: {
    ...presentationToolContract,
    auth: "service-role"
  } as any,
  run: async (_ctx: AgentToolContext, input) => generatePresentationArtifact(input as any) as any
};

const calendarTool: McpTool<z.infer<typeof CalendarSlotsInputSchema>, z.infer<typeof CalendarSlotsOutputSchema>> = {
  contract: {
    name: "suggestViewingSlots",
    description: "Doporuči volné časové sloty pro prohlídku z Google Calendar (free/busy).",
    inputSchema: CalendarSlotsInputSchema,
    outputSchema: CalendarSlotsOutputSchema,
    auth: "service-role",
    sideEffects: []
  },
  run: async (_ctx: AgentToolContext, input) =>
    suggestViewingSlots({ userId: input.userId, daysAhead: input.daysAhead, limit: input.limit })
};

const emailTool: McpTool<z.infer<typeof EmailDraftInputSchema>, z.infer<typeof EmailDraftOutputSchema>> = {
  contract: {
    name: "createEmailDraft",
    description: "Vytvoří draft emailu v Gmailu (nikdy neodesílá).",
    inputSchema: EmailDraftInputSchema,
    outputSchema: EmailDraftOutputSchema,
    auth: "service-role",
    sideEffects: ["Gmail draft create"]
  },
  run: async (_ctx: AgentToolContext, input) =>
    createEmailDraft({
      userId: input.userId,
      to: input.to,
      subject: input.subject,
      body: input.body
    })
};

const workflowTool: McpTool<z.infer<typeof EnqueueWorkflowTaskInputSchema>, unknown> = {
  contract: {
    name: "enqueueWorkflowTask",
    description: "Zařadí úlohu do externího workflow endpointu.",
    inputSchema: EnqueueWorkflowTaskInputSchema,
    outputSchema: EnqueueWorkflowTaskOutputSchema,
    auth: "service-role",
    sideEffects: ["External HTTP POST"]
  },
  run: async (_ctx: AgentToolContext, input) => enqueueWorkflowTask({ endpoint: input.endpoint, payload: input.payload })
};

const tools = {
  runSqlPreset: sqlTool,
  generateReportArtifacts: reportTool,
  generatePresentationArtifact: presentationTool,
  suggestViewingSlots: calendarTool,
  createEmailDraft: emailTool,
  enqueueWorkflowTask: workflowTool
};

export function getToolRunner() {
  return new ToolRunner(tools as any);
}

