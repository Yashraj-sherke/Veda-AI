import { describe, expect, it } from "vitest";
import { normalizeQuestionLabel, questionLabelsMatch } from "@/lib/mapping/normalize";

describe("normalizeQuestionLabel", () => {
  it.each(["11(a)", "11 (a)", "Q11(a)", "Q. 11(a)", "11-a", "11 a"])(
    "normalizes %s to the same logical label",
    (label) => expect(normalizeQuestionLabel(label)).toBe("11(a)"),
  );

  it("supports roman numeral and nested sub-parts", () => {
    expect(normalizeQuestionLabel("12 (ii)")).toBe("12(ii)");
    expect(normalizeQuestionLabel("4(a)(i)")).toBe("4(a)(i)");
  });

  it("compares variants without changing display labels", () => {
    expect(questionLabelsMatch("Q.11 - a", "11(a)")).toBe(true);
  });
});
