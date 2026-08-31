import type { ExtractedAnswer } from "@/types/assessment";

function textForRegion(answer: ExtractedAnswer, regionIndex: number) {
  if (answer.regions.length === 1) return answer.text;
  const words = answer.text.split(" ");
  const split = Math.ceil(words.length / answer.regions.length);
  return words.slice(regionIndex * split, (regionIndex + 1) * split).join(" ");
}

export function DemoAnswerPage({ pageNumber, answers }: { pageNumber: number; answers: ExtractedAnswer[] }) {
  return (
    <div className="demo-paper" aria-label={`Synthetic answer sheet page ${pageNumber}`}>
      <div className="paper-margin" />
      <div className="paper-header">
        <span>DELHI PUBLIC SCHOOL</span>
        <span>Biology • Answer Sheet</span>
      </div>
      <div className="student-line">
        <span>Name: Aarav Mehta</span>
        <span>Class: X-B</span>
        <span>Page {pageNumber}</span>
      </div>
      {answers.flatMap((answer) =>
        answer.regions.map((region, regionIndex) => {
          if (region.pageNumber !== pageNumber) return null;
          const { x, y, width, height } = region.boundingBox;
          return (
            <div
              className="handwritten-answer"
              key={region.id}
              style={{
                left: `${x * 100}%`,
                top: `${y * 100}%`,
                width: `${width * 100}%`,
                height: `${height * 100}%`,
              }}
            >
              <strong>{answer.detectedLabel ? `${answer.detectedLabel}.` : ""}</strong>
              <span>{textForRegion(answer, regionIndex)}</span>
              {answer.id === "answer-6" && (
                <span className="sketch-row" aria-hidden="true">liver ─ stomach ─ pancreas<br />　　　 ╰ small intestine ╯</span>
              )}
              {answer.id === "answer-12" && <span className="equation-row">0.5 L × 12 min⁻¹ = 6 L min⁻¹</span>}
            </div>
          );
        }),
      )}
      <div className="paper-footer">— {pageNumber} —</div>
    </div>
  );
}
