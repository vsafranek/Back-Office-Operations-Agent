import { describe, expect, it } from "vitest";
import { extractAnswerTextFromPartialModelJson } from "@/lib/agent/llm/user-facing-reply";

describe("extractAnswerTextFromPartialModelJson", () => {
  it("vrátí prázdný řetězec dokud není klíč answer_text", () => {
    expect(extractAnswerTextFromPartialModelJson(`{"confidences`)).toBe("");
  });

  it("vrátí rostoucí prefix během „streamu“ JSON", () => {
    const parts = [
      `{"answer_text":"`,
      `Ahoj`,
      ` světe`,
      `","confidence":0.9}`
    ];
    let acc = "";
    let seen = "";
    for (const p of parts) {
      acc += p;
      seen = extractAnswerTextFromPartialModelJson(acc);
    }
    expect(seen).toBe("Ahoj světe");
  });

  it("dekóduje \\n a uvozené uvozovky", () => {
    const raw = String.raw`{"answer_text":"Řádek\na \"citát\""}`;
    expect(extractAnswerTextFromPartialModelJson(raw)).toBe('Řádek\na "citát"');
  });
});
