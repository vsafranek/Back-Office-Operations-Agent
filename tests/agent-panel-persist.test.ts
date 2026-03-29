import { describe, expect, it } from "vitest";
import {
  AGENT_PANEL_MAX_ROWS,
  agentAnswerSliceFromPersistPayload,
  buildAgentPanelPersistPayload
} from "@/lib/agent/conversation/agent-panel-persist";
import type { AgentAnswer } from "@/lib/agent/types";

describe("agent-panel-persist", () => {
  it("truncates analytic rows and adds Czech note", () => {
    const rows = Array.from({ length: AGENT_PANEL_MAX_ROWS + 10 }, (_, i) => ({ i }));
    const answer: AgentAnswer = {
      answer_text: "",
      confidence: 1,
      sources: [],
      generated_artifacts: [],
      next_actions: [],
      dataPanel: {
        kind: "clients_filtered",
        source: "unit",
        title: "Test",
        rows
      }
    };
    const p = buildAgentPanelPersistPayload(answer);
    expect(p?.v).toBe(1);
    const panel = p?.bundles[0]?.dataPanel;
    expect(panel?.kind).toBe("clients_filtered");
    if (panel?.kind === "clients_filtered") {
      expect(panel.rows.length).toBe(AGENT_PANEL_MAX_ROWS);
      expect(panel.rowsTruncationNote).toContain("Excel");
    }
  });

  it("roundtrips slice from metadata payload", () => {
    const payload = buildAgentPanelPersistPayload({
      answer_text: "",
      confidence: 1,
      sources: [],
      generated_artifacts: [],
      next_actions: [],
      dataPanel: {
        kind: "clients_q1",
        source: "vw",
        rows: [{ a: 1 }],
        charts: []
      }
    });
    expect(payload).not.toBeNull();
    const slice = agentAnswerSliceFromPersistPayload(payload);
    expect(slice?.dataPanel?.kind).toBe("clients_q1");
  });
});
