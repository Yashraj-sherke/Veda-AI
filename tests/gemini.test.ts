import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiProvider } from "../lib/ai/gemini";

describe("GeminiProvider fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the next stable model when the configured model is overloaded", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: { message: "This model is currently experiencing high demand." } }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ))
      .mockResolvedValueOnce(new Response(
        JSON.stringify({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  questions: [{
                    originalNumber: "1",
                    text: "Example question",
                    pageNumber: 1,
                    confidence: 0.95,
                  }],
                }),
              }],
            },
          }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const questions = await provider.extractQuestions({ parts: [] });

    expect(questions).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("gemini-3.6-flash");
    expect(fetchMock.mock.calls[1][0]).toContain("gemini-3.1-flash-lite");

    const firstRequest = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = JSON.parse(firstRequest.body as string);
    expect(requestBody.generationConfig.responseFormat).toMatchObject({
      text: {
        mimeType: "APPLICATION_JSON",
        schema: {
          type: "object",
          required: ["questions"],
        },
      },
    });
  });

  it("requests native vision boxes and converts them to viewer coordinates", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({
        candidates: [{
          content: {
            parts: [{
              text: JSON.stringify({
                answers: [{
                  detectedLabel: "17(c)",
                  text: "Base stacking adds stability.",
                  confidence: 0.94,
                  regions: [{
                    pageNumber: 4,
                    box_2d: [520, 110, 640, 900],
                    confidence: 0.96,
                  }],
                }],
              }),
            }],
          },
        }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new GeminiProvider("test-key", "gemini-3.6-flash");
    const answers = await provider.extractAnswers({ parts: [] });

    expect(answers[0].regions[0]).toMatchObject({
      pageNumber: 4,
      boundingBox: { x: 0.11, y: 0.52, width: 0.79, height: 0.12 },
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    const requestBody = JSON.parse(request.body as string);
    expect(requestBody.generationConfig).toMatchObject({
      mediaResolution: "MEDIA_RESOLUTION_HIGH",
      thinkingConfig: { thinkingLevel: "MINIMAL" },
      responseFormat: {
        text: {
          mimeType: "APPLICATION_JSON",
          schema: {
            properties: {
              answers: {
                items: {
                  properties: {
                    regions: {
                      items: {
                        properties: { box_2d: { minItems: 4, maxItems: 4 } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  });
});
