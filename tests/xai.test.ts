import { afterEach, describe, expect, it, vi } from "vitest";
import { XaiProvider } from "../lib/ai/xai";

describe("XaiProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends image documents through the Responses API with a strict JSON schema", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        output: [{
          type: "message",
          content: [{
            type: "output_text",
            text: JSON.stringify({
              questions: [{
                originalNumber: "1",
                text: "Example question",
                pageNumber: 1,
                confidence: 0.9,
              }],
            }),
          }],
        }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new XaiProvider("test-key", "grok-4.6");
    const questions = await provider.extractQuestions({
      parts: [{
        name: "question.png",
        mimeType: "image/png",
        base64: "AA==",
      }],
    });

    expect(questions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.x.ai/v1/responses");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string) as {
      model: string;
      input: Array<{ content: Array<{ type: string; image_url?: string }> }>;
      text: { format: { type: string; strict: boolean } };
    };
    expect(body.model).toBe("grok-4.6");
    expect(body.input[0].content[1]).toEqual({
      type: "input_image",
      image_url: "data:image/png;base64,AA==",
    });
    expect(body.text.format.type).toBe("json_schema");
    expect(body.text.format.strict).toBe(true);
  });
});
