"use client";

import { useMemo, useState } from "react";
import type { AssessmentQuestion, AssessmentResult, ExtractedAnswer, UploadedDocument } from "@/types/assessment";
import { AnswerViewer } from "./AnswerViewer";
import { QuestionPanel } from "./QuestionPanel";

export function ReviewWorkspace({
  assessment,
  answerDocument,
}: {
  assessment: AssessmentResult;
  answerDocument: UploadedDocument | null;
}) {
  const firstQuestion = assessment.questions.find((question) => question.answerId) ?? assessment.questions[0];
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(firstQuestion?.id ?? null);
  const [activeAnswerId, setActiveAnswerId] = useState<string | null>(firstQuestion?.answerId ?? null);
  const [mobileTab, setMobileTab] = useState<"questions" | "answer">("questions");
  const activeQuestion = assessment.questions.find((question) => question.id === activeQuestionId);
  const activeAnswer = assessment.answers.find((answer) => answer.id === activeAnswerId) ?? null;

  const label = useMemo(() => {
    if (activeQuestion) return `Q${activeQuestion.originalNumber}`;
    if (activeAnswer) return activeAnswer.detectedLabel || "Unmapped";
    return "Selected question";
  }, [activeQuestion, activeAnswer]);

  function selectQuestion(question: AssessmentQuestion) {
    setActiveQuestionId(question.id);
    setActiveAnswerId(question.answerId ?? null);
    setMobileTab("answer");
  }

  function selectUnmapped(answer: ExtractedAnswer) {
    setActiveQuestionId(null);
    setActiveAnswerId(answer.id);
    setMobileTab("answer");
  }

  return (
    <main className="review-screen">
      <div className="review-mobile-tabs" role="tablist" aria-label="Review panels">
        <button type="button" role="tab" aria-selected={mobileTab === "questions"} className={mobileTab === "questions" ? "active" : ""} onClick={() => setMobileTab("questions")}>
          Questions
        </button>
        <button type="button" role="tab" aria-selected={mobileTab === "answer"} className={mobileTab === "answer" ? "active" : ""} onClick={() => setMobileTab("answer")}>
          Answer Sheet
        </button>
      </div>
      <div className="review-workspace">
        <div className={`review-pane review-pane--questions ${mobileTab === "questions" ? "review-pane--mobile-active" : ""}`}>
          <QuestionPanel
            assessment={assessment}
            activeQuestionId={activeQuestionId}
            activeAnswerId={activeAnswerId}
            onSelectQuestion={selectQuestion}
            onSelectUnmapped={selectUnmapped}
          />
        </div>
        <div className={`review-pane review-pane--viewer ${mobileTab === "answer" ? "review-pane--mobile-active" : ""}`}>
          <AnswerViewer
            key={activeAnswer?.id ?? label}
            assessment={assessment}
            answer={activeAnswer}
            questionLabel={label}
            files={answerDocument?.files}
          />
        </div>
      </div>
    </main>
  );
}
