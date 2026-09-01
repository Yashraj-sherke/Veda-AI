"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisProgress, AssessmentResult, UploadedDocument } from "@/types/assessment";
import { AppChrome } from "@/components/AppChrome";
import { ProcessingScreen } from "@/components/ProcessingScreen";
import { ReviewWorkspace } from "@/components/ReviewWorkspace";
import { UploadScreen } from "@/components/UploadScreen";

type View = "upload" | "processing" | "review";

type ProcessStreamEvent =
  | { type: "progress"; progress: AnalysisProgress }
  | { type: "result"; result: AssessmentResult }
  | { type: "error"; error: string };

const INITIAL_PROGRESS: AnalysisProgress = {
  stage: "uploading",
  value: 8,
  label: "Uploading both files",
  detail: "Sending the question paper and answer sheet securely for analysis.",
};

function parseJson<T>(value: string): T | null {
  try {
    return value ? JSON.parse(value) as T : null;
  } catch {
    return null;
  }
}

export default function HomePage() {
  const [view, setView] = useState<View>("upload");
  const [questionPaper, setQuestionPaper] = useState<UploadedDocument | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadedDocument | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState<AnalysisProgress>(INITIAL_PROGRESS);
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
    setProcessingProgress(INITIAL_PROGRESS);
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

      if (!response.ok) {
        const rawPayload = await response.text();
        const payload = parseJson<{ error?: string }>(rawPayload);
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

      let result: AssessmentResult | null = null;
      if (response.headers.get("content-type")?.includes("application/x-ndjson")) {
        if (!response.body) throw new Error("The analysis service did not return a response stream.");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const handleLine = (line: string) => {
          const event = parseJson<ProcessStreamEvent>(line);
          if (!event) return;
          if (event.type === "progress") setProcessingProgress(event.progress);
          if (event.type === "result") result = event.result;
          if (event.type === "error") throw new Error(event.error);
        };

        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          lines.filter(Boolean).forEach(handleLine);
          if (done) break;
        }
        if (buffer.trim()) handleLine(buffer);
      } else {
        result = parseJson<AssessmentResult>(await response.text());
      }

      if (!result || !("questions" in result)) {
        throw new Error("The analysis service returned an invalid response. Please retry.");
      }
      setProcessingProgress({
        stage: "finalizing",
        value: 100,
        label: "Analysis complete",
        detail: "Opening the synchronized teacher review workspace.",
      });
      setAssessment(result);
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
          progress={processingProgress}
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
