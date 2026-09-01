"use client";

import { useEffect, useRef, useState } from "react";
import type { AssessmentResult, UploadedDocument } from "@/types/assessment";
import { AppChrome } from "@/components/AppChrome";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { UploadScreen } from "@/components/UploadScreen";

type View = "upload" | "processing" | "review";

export default function HomePage() {
  const [view, setView] = useState<View>("upload");
  const [questionPaper, setQuestionPaper] = useState<UploadedDocument | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadedDocument | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  async function processAssessment(demo = false) {
    if (!demo && (!questionPaper || !answerSheet)) {
      setUploadError("Upload both documents before starting the analysis.");
      return;
    }
    setView("processing");
    setProcessingError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    if (demo) {
      formData.set("demo", "true");
    } else {
      questionPaper?.files.forEach((file) => formData.append("questionPaper", file));
      answerSheet?.files.forEach((file) => formData.append("answerSheet", file));
    }

    try {
      const response = await fetch("/api/process", { method: "POST", body: formData, signal: controller.signal });
      const rawPayload = await response.text();
      let payload: AssessmentResult | { error?: string } | null = null;
      try {
        payload = rawPayload ? JSON.parse(rawPayload) as AssessmentResult | { error?: string } : null;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const apiMessage = payload && typeof payload === "object" && "error" in payload
          ? payload.error
          : undefined;
        const statusMessage = response.status === 413
          ? "The selected documents are too large for this deployment. Keep each document at 2 MB or less."
          : response.status === 504
            ? "Document analysis timed out. Please retry with shorter documents or use Demo Mode."
            : `Analysis failed with status ${response.status}. Please retry.`;
        throw new Error(apiMessage || statusMessage);
      }
      if (!payload || !("questions" in payload)) {
        throw new Error("The analysis service returned an invalid response. Please retry.");
      }
      setAssessment(payload);
      setView("review");
    } catch (error) {
      if (controller.signal.aborted) return;
      setProcessingError(error instanceof Error ? error.message : "The assessment could not be processed.");
    }
  }

  function cancelProcessing() {
    abortRef.current?.abort();
    setProcessingError(null);
    setView("upload");
  }

  if (view === "processing") {
    return (
      <AppChrome compact>
        <ProcessingScreen
          error={processingError}
          onRetry={() => void processAssessment(false)}
          onCancel={cancelProcessing}
        />
      </AppChrome>
    );
  }

  if (view === "review" && assessment) {
    return (
      <AppChrome compact>
        <ReviewWorkspace assessment={assessment} answerDocument={answerSheet} />
      </AppChrome>
    );
  }

  return (
    <AppChrome>
      <UploadScreen
        questionPaper={questionPaper}
        answerSheet={answerSheet}
        setQuestionPaper={setQuestionPaper}
        setAnswerSheet={setAnswerSheet}
        error={uploadError}
        setError={setUploadError}
        onAnalyze={() => void processAssessment(false)}
        onDemo={() => void processAssessment(true)}
      />
    </AppChrome>
  );
}
