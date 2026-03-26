export type AgentArtifact = {
  type: "chart" | "table" | "report" | "presentation" | "email";
  label: string;
  url?: string;
  content?: string;
};

export type AgentAnswer = {
  answer_text: string;
  confidence: number;
  sources: string[];
  generated_artifacts: AgentArtifact[];
  next_actions: string[];
};

export type AgentToolContext = {
  runId: string;
  userId: string;
};
