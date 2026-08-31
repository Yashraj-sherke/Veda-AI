"use client";

import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";
import type { UploadedDocument } from "@/types/assessment";
import { UploadZone } from "./UploadZone";

export function UploadScreen({
  questionPaper,
  answerSheet,
  setQuestionPaper,
  setAnswerSheet,
  error,
  setError,
  onAnalyze,
  onDemo,
}: {
  questionPaper: UploadedDocument | null;
  answerSheet: UploadedDocument | null;
  setQuestionPaper: (document: UploadedDocument | null) => void;
  setAnswerSheet: (document: UploadedDocument | null) => void;
  error: string | null;
  setError: (error: string | null) => void;
  onAnalyze: () => void;
  onDemo: () => void;
}) {
  const ready = Boolean(questionPaper && answerSheet);

  return (
    <main className="upload-screen">
      <section className="upload-content" aria-labelledby="upload-heading">
        <div className="upload-header-block">
          <h1 id="upload-heading">
            Upload <span className="upload-highlight-badge">Question Paper &amp; Answer Sheets</span>
          </h1>
          <p className="upload-subtitle">Upload both files to get started</p>
        </div>

        <div className="teacher-orbit-wrapper" aria-hidden="true">
          <Image
            className="teacher-orbit-image"
            src="/teacher-orbit.png"
            alt=""
            width={160}
            height={160}
          />
        </div>

        <div className="upload-pair">
          <UploadZone
            title="Question Paper"
            value={questionPaper}
            onChange={setQuestionPaper}
            onError={setError}
          />
          <UploadZone
            title="Answer Sheet"
            value={answerSheet}
            onChange={setAnswerSheet}
            onError={setError}
          />
        </div>

        {error && <div className="inline-error" role="alert">{error}</div>}

        <div className="upload-actions-container">
          <div className="upload-buttons-row">
            <button
              type="button"
              className={`start-mapping-btn ${ready ? "start-mapping-btn--ready" : ""}`}
              disabled={!ready}
              onClick={onAnalyze}
            >
              <span>Start Mapping</span> <ArrowRight size={17} />
            </button>
            <button type="button" className="explore-demo-btn" onClick={onDemo}>
              <Sparkles size={15} /> Explore Demo
            </button>
          </div>
          <p className="upload-footer-notice">
            Once both files are uploaded, you&apos;ll able to map answers with questions
          </p>
        </div>
      </section>
    </main>
  );
}
