"use client";

import { AlertTriangle, ChevronDown, FileQuestion, LocateFixed, Sparkles } from "lucide-react";
import { useState } from "react";
import type { AssessmentQuestion, AssessmentResult, ExtractedAnswer } from "@/types/assessment";
import { confidenceLabel, StatusBadge } from "./StatusBadge";

function ScorePill({ question }: { question: AssessmentQuestion }) {
  if (question.marks === undefined) return <span className="marks-pill">Marks n/a</span>;
  const score = question.score ?? 0;
  const marks = question.marks;
  const variant =
    score === 0
      ? "score-pill--zero"
      : score < marks
        ? "score-pill--partial"
        : "score-pill--full";

  return (
    <span className={`score-pill ${variant}`}>
      {score}/{marks}
    </span>
  );
}

export function QuestionPanel({
  assessment,
  activeQuestionId,
  activeAnswerId,
  onSelectQuestion,
  onSelectUnmapped,
}: {
  assessment: AssessmentResult;
  activeQuestionId: string | null;
  activeAnswerId: string | null;
  onSelectQuestion: (question: AssessmentQuestion) => void;
  onSelectUnmapped: (answer: ExtractedAnswer) => void;
}) {
  const { summary } = assessment;
  const [allExpanded, setAllExpanded] = useState(false);
  const answerById = new Map(assessment.answers.map((answer) => [answer.id, answer]));
  const unmappedAnswers = assessment.unmappedAnswerIds
    .map((answerId) => answerById.get(answerId))
    .filter((answer): answer is ExtractedAnswer => Boolean(answer));

  return (
    <section className="question-panel" aria-label="Extracted questions">
      <div className="assessment-summary">
        <div className="summary-heading-row">
          <div>
            <span className="summary-eyebrow">Assessment review</span>
            <h1>{summary.totalQuestions} extracted questions</h1>
          </div>
          <span className={`mode-badge mode-badge--${assessment.mode}`}>
            <Sparkles size={12} /> {assessment.mode === "demo" ? "Demo mode" : "Live AI"}
          </span>
        </div>
        <div className="summary-grid">
          <div><strong>{summary.answered}</strong><span>Answered</span></div>
          <div><strong>{summary.unanswered}</strong><span>Unanswered</span></div>
          <div><strong>{summary.needsReview}</strong><span>Review</span></div>
          <div className="summary-score"><strong>{summary.earnedMarks}<small>/{summary.totalMarks}</small></strong><span>AI estimate</span></div>
        </div>
        <div className="confidence-strip">
          <span><i className="confidence-dot confidence-dot--high" /> {summary.highConfidence} high confidence</span>
          <span><i className="confidence-dot confidence-dot--medium" /> {summary.mediumConfidence} medium</span>
        </div>
      </div>

      <div className="question-list-heading">
        <span>Extracted Questions <small>(from question paper)</small></span>
        <button type="button" onClick={() => setAllExpanded((prev) => !prev)}>
          {allExpanded ? "Collapse all" : "Expand all"}
        </button>
      </div>

      <div className="question-list">
        {assessment.questions.map((question, index) => {
          const active = allExpanded || question.id === activeQuestionId;
          const answer = question.answerId ? answerById.get(question.answerId) : undefined;
          return (
            <article className={`question-card ${active ? "question-card--active" : ""}`} key={question.id}>
              <button
                type="button"
                className="question-card-button"
                onClick={() => { setAllExpanded(false); onSelectQuestion(question); }}
                aria-expanded={active}
              >
                <span className="question-number">{index + 1}</span>
                <span className="question-card-content">
                  <span className="question-meta-row">
                    <strong>Q{question.originalNumber}</strong>
                    <span className="question-card-badges">
                      <StatusBadge status={question.status} compact={!active} />
                      <ScorePill question={question} />
                    </span>
                  </span>
                  <span className="question-text">{question.text}</span>
                </span>
                <ChevronDown className={`question-chevron ${active ? "question-chevron--open" : ""}`} size={15} />
              </button>
              {active && (
                <div className="question-detail">
                  {answer ? (
                    <>
                      <div className="detail-label-row">
                        <span>Student answer</span>
                        <button type="button" onClick={() => { setAllExpanded(false); onSelectQuestion(question); }}>
                          <LocateFixed size={13} /> Page {answer.regions[0]?.pageNumber}
                        </button>
                      </div>
                      <p className="answer-preview">{answer.text}</p>
                      <div className="mapping-row">
                        <span>{confidenceLabel(question.mappingConfidence)}</span>
                        <strong>{Math.round((question.mappingConfidence ?? 0) * 100)}%</strong>
                      </div>
                    </>
                  ) : (
                    <div className="unanswered-detail">
                      <FileQuestion size={18} />
                      <span>No corresponding answer was found on the answer sheet.</span>
                    </div>
                  )}
                  {question.feedback && (
                    <div className="ai-feedback">
                      <span><Sparkles size={13} /> AI-generated assessment</span>
                      <p>{question.feedback}</p>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {unmappedAnswers.length > 0 && (
          <section className="unmapped-section" aria-labelledby="unmapped-heading">
            <div className="unmapped-heading" id="unmapped-heading">
              <span><AlertTriangle size={15} /> Unmapped Answers</span>
              <strong>{unmappedAnswers.length}</strong>
            </div>
            <p>These responses need a teacher to confirm their question.</p>
            {unmappedAnswers.map((answer) => (
              <button
                className={`unmapped-answer ${activeAnswerId === answer.id ? "unmapped-answer--active" : ""}`}
                type="button"
                key={answer.id}
                onClick={() => onSelectUnmapped(answer)}
              >
                <span>Page {answer.startPage}</span>
                <strong>{answer.text}</strong>
                <LocateFixed size={15} />
              </button>
            ))}
          </section>
        )}
      </div>
    </section>
  );
}
