"use client";

import { Check, FileSearch, LocateFixed, RotateCcw, Sparkles, UploadCloud, X, XCircle } from "lucide-react";
import type { AnalysisProgress } from "@/types/assessment";

const stages = [
  { key: "uploading", label: "Upload both files", icon: UploadCloud },
  { key: "extracting", label: "Extract questions and answers", icon: FileSearch },
  { key: "mapping", label: "Map labels and sub-parts", icon: LocateFixed },
  { key: "finalizing", label: "Prepare highlights", icon: Sparkles },
] as const;

export function ProcessingScreen({
  progress,
  error,
  onRetry,
  onCancel,
}: {
  progress: AnalysisProgress;
  error?: string | null;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.key === progress.stage));

  return (
    <main className="processing-screen" aria-live="polite">
      <div className="processing-viewport-card">
        <button
          className="processing-close-btn"
          type="button"
          aria-label="Cancel processing"
          onClick={onCancel}
        >
          <X size={18} />
        </button>

        {error ? (
          <div className="processing-error-box">
            <div className="processing-error-icon">
              <XCircle size={44} />
            </div>
            <h2>We couldn&apos;t finish the analysis</h2>
            <p>{error}</p>
            <div className="processing-error-actions">
              <button className="primary-button" type="button" onClick={onRetry}>
                <RotateCcw size={16} /> Retry analysis
              </button>
              <button className="secondary-button" type="button" onClick={onCancel}>
                Back to upload
              </button>
            </div>
          </div>
        ) : (
          <div className="processing-extract-box">
            <div className="sparkle-constellation-container">
              <svg
                viewBox="0 0 140 140"
                className="sparkle-constellation-svg"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                {/* Large Main Star */}
                <path
                  d="M78 20 C78 44 90 56 114 56 C90 56 78 68 78 92 C78 68 66 56 42 56 C66 56 78 44 78 20 Z"
                  fill="url(#sparkle-gradient-main)"
                  className="sparkle-star sparkle-star--main"
                />

                {/* Medium Star (Bottom Left) */}
                <path
                  d="M48 68 C48 82 56 90 70 90 C56 90 48 98 48 112 C48 98 40 90 26 90 C40 90 48 82 48 68 Z"
                  fill="url(#sparkle-gradient-sub)"
                  className="sparkle-star sparkle-star--sub"
                />

                {/* Small Star (Bottom Right) */}
                <path
                  d="M98 78 C98 86 102 90 110 90 C102 90 98 94 98 102 C98 94 94 90 86 90 C94 90 98 86 98 78 Z"
                  fill="url(#sparkle-gradient-sub)"
                  className="sparkle-star sparkle-star--tiny"
                />

                {/* Left Dot */}
                <circle
                  cx="32"
                  cy="62"
                  r="4.5"
                  fill="#ff6a3d"
                  className="sparkle-dot"
                />

                <defs>
                  <linearGradient
                    id="sparkle-gradient-main"
                    x1="42"
                    y1="20"
                    x2="114"
                    y2="92"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#ff7b54" />
                    <stop offset="1" stopColor="#ff4d28" />
                  </linearGradient>
                  <linearGradient
                    id="sparkle-gradient-sub"
                    x1="26"
                    y1="68"
                    x2="70"
                    y2="112"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#ff7a52" />
                    <stop offset="1" stopColor="#ff5330" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <h1 className="extracting-title">{progress.label}</h1>
            <p className="extracting-subtitle">{progress.detail}</p>

            <div className="processing-progress" aria-label="Assessment analysis progress">
              <div className="processing-progress-meta">
                <span>Step {activeIndex + 1} of {stages.length}</span>
                <strong>{progress.value}%</strong>
              </div>
              <div
                className="processing-progress-track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress.value}
                aria-valuetext={progress.label}
              >
                <span style={{ width: `${progress.value}%` }} />
              </div>
              <ol className="processing-stage-list">
                {stages.map((stage, index) => {
                  const Icon = stage.icon;
                  const complete = index < activeIndex;
                  const active = index === activeIndex;
                  return (
                    <li
                      className={`${complete ? "processing-stage--complete" : ""} ${active ? "processing-stage--active" : ""}`}
                      key={stage.key}
                    >
                      <span>{complete ? <Check size={14} /> : <Icon size={14} />}</span>
                      {stage.label}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
