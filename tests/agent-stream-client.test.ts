import { describe, expect, it } from "vitest";
import { readAgentNdjsonStream } from "@/lib/agent/stream-client";
import type { AgentAnswer } from "@/lib/agent/types";

function streamResponse(body: string, splitAt?: number): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        if (splitAt != null && splitAt > 0 && splitAt < body.length) {
          controller.enqueue(enc.encode(body.slice(0, splitAt)));
          controller.enqueue(enc.encode(body.slice(splitAt)));
        } else {
          controller.enqueue(enc.encode(body));
        }
        controller.close();
      }
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
  );
}

describe("readAgentNdjsonStream", () => {
  it("parsuje fáze a finální result", async () => {
    const phases: string[] = [];
    const payload: AgentAnswer = {
      answer_text: "Ahoj",
      confidence: 0.9,
      sources: ["x"],
      generated_artifacts: [],
      next_actions: []
    };
    const body =
      `${JSON.stringify({ type: "phase", label: "Start" })}\n${JSON.stringify({ type: "phase", label: "Konec" })}\n${JSON.stringify({ type: "result", payload })}\n`;
    const out = await readAgentNdjsonStream(streamResponse(body, 25), { onPhase: (l) => phases.push(l) });
    expect(phases).toEqual(["Start", "Konec"]);
    expect(out.answer_text).toBe("Ahoj");
  });

  it("vyhodí error řádek", async () => {
    const res = streamResponse(`${JSON.stringify({ type: "error", message: "Selhalo" })}\n`);
    await expect(readAgentNdjsonStream(res)).rejects.toThrow("Selhalo");
  });

  it("předá orchestrator_delta", async () => {
    const chunks: string[] = [];
    const payload: AgentAnswer = {
      answer_text: "OK",
      confidence: 1,
      sources: [],
      generated_artifacts: [],
      next_actions: []
    };
    const body = [
      JSON.stringify({ type: "orchestrator_delta", text: "Ah" }),
      JSON.stringify({ type: "orchestrator_delta", text: "oj" }),
      JSON.stringify({ type: "result", payload })
    ].join("\n");
    const out = await readAgentNdjsonStream(streamResponse(`${body}\n`), {
      onOrchestratorDelta: (t) => chunks.push(t)
    });
    expect(chunks.join("")).toBe("Ahoj");
    expect(out.answer_text).toBe("OK");
  });

  it("předá answer_delta", async () => {
    const chunks: string[] = [];
    const payload: AgentAnswer = {
      answer_text: "Finál",
      confidence: 1,
      sources: [],
      generated_artifacts: [],
      next_actions: []
    };
    const body = [
      JSON.stringify({ type: "answer_delta", text: "Fi" }),
      JSON.stringify({ type: "answer_delta", text: "nál" }),
      JSON.stringify({ type: "result", payload })
    ].join("\n");
    const out = await readAgentNdjsonStream(streamResponse(`${body}\n`), {
      onAnswerDelta: (t) => chunks.push(t)
    });
    expect(chunks.join("")).toBe("Finál");
    expect(out.answer_text).toBe("Finál");
  });
});
