"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  FileWarning,
  LocateFixed,
  Minus,
  Plus,
  ScanLine,
} from "lucide-react";
import type { AssessmentResult, ExtractedAnswer } from "@/types/assessment";
import { DemoAnswerPage } from "./DemoAnswerPage";

const PdfDocumentPage = dynamic(
  () => import("./PdfDocumentPage").then((module) => module.PdfDocumentPage),
  {
    ssr: false,
    loading: () => <div className="document-loading"><ScanLine size={24} /> Loading PDF viewer…</div>,
  },
);

function RegionOverlay({
  answer,
  pageNumber,
  label,
}: {
  answer: ExtractedAnswer | null;
  pageNumber: number;
  label: string;
}) {
  if (!answer) return null;
  return (
    <div className="region-overlay-layer" aria-hidden="true">
      {answer.regions
        .filter((region) => region.pageNumber === pageNumber)
        .map((region) => (
          <div
            className="answer-highlight"
            data-region-id={region.id}
            key={region.id}
            style={{
              left: `${region.boundingBox.x * 100}%`,
              top: `${region.boundingBox.y * 100}%`,
              width: `${region.boundingBox.width * 100}%`,
              height: `${region.boundingBox.height * 100}%`,
            }}
          >
            <span className="highlight-tag">{label}</span>
          </div>
        ))}
    </div>
  );
}

export function AnswerViewer({
  assessment,
  answer,
  questionLabel,
  files,
}: {
  assessment: AssessmentResult;
  answer: ExtractedAnswer | null;
  questionLabel: string;
  files?: File[];
}) {
  const [currentPage, setCurrentPage] = useState(answer?.regions[0]?.pageNumber ?? 1);
  const [activeRegionIndex, setActiveRegionIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(760);
  const [renderVersion, setRenderVersion] = useState(0);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isDemo = assessment.mode === "demo";
  const pageCount = assessment.answerSheet.pageCount;

  const imageUrls = useMemo(
    () => (files ?? []).filter((file) => file.type.startsWith("image/")).map((file) => URL.createObjectURL(file)),
    [files],
  );
  useEffect(() => () => imageUrls.forEach((url) => URL.revokeObjectURL(url)), [imageUrls]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(Math.max(360, entry.contentRect.width - 56)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!answer) return;
    const region = answer.regions[activeRegionIndex];
    if (!region || region.pageNumber !== currentPage) return;
    const timer = window.setTimeout(() => {
      const target = viewerRef.current?.querySelector<HTMLElement>(`[data-region-id="${region.id}"]`);
      target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [answer, activeRegionIndex, currentPage, renderVersion, zoom]);

  function goToRegion(index: number) {
    if (!answer?.regions[index]) return;
    setActiveRegionIndex(index);
    setCurrentPage(answer.regions[index].pageNumber);
  }

  const pageWidth = Math.max(360, Math.min(820, viewportWidth)) * zoom;
  const pdfFile = files?.[0]?.type === "application/pdf" ? files[0] : undefined;

  return (
    <section className="answer-viewer" aria-label="Answer sheet viewer">
      <div className="viewer-titlebar">
        <div>
          <span className="viewer-kicker">Original document</span>
          <strong>Student Answer Sheet</strong>
        </div>
        <span className="viewer-document-name" title={assessment.answerSheet.name}>{assessment.answerSheet.name}</span>
      </div>

      <div className="viewer-toolbar">
        <div className="zoom-control" aria-label="Zoom controls">
          <button type="button" aria-label="Zoom out" onClick={() => setZoom((value) => Math.max(0.65, value - 0.15))}><Minus size={15} /></button>
          <button type="button" className="zoom-value" onClick={() => setZoom(1)} aria-label="Fit to width">{Math.round(zoom * 100)}%</button>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom((value) => Math.min(1.75, value + 0.15))}><Plus size={15} /></button>
        </div>
        <div className="page-control">
          <button type="button" aria-label="Previous page" disabled={currentPage <= 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><ChevronLeft size={15} /></button>
          <strong>Page {currentPage} of {pageCount}</strong>
          <button type="button" aria-label="Next page" disabled={currentPage >= pageCount} onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}><ChevronRight size={15} /></button>
        </div>
        {answer && answer.regions.length > 1 && (
          <div className="continuation-control">
            <span>Answer continues</span>
            <button type="button" disabled={activeRegionIndex === 0} onClick={() => goToRegion(activeRegionIndex - 1)} aria-label="Previous answer region"><ChevronLeft size={14} /></button>
            <strong>{activeRegionIndex + 1}/{answer.regions.length}</strong>
            <button type="button" disabled={activeRegionIndex === answer.regions.length - 1} onClick={() => goToRegion(activeRegionIndex + 1)} aria-label="Next answer region"><ChevronRight size={14} /></button>
          </div>
        )}
      </div>

      {!answer && (
        <div className="viewer-notice" role="status">
          <FileWarning size={17} />
          <span><strong>No mapped answer for {questionLabel}.</strong> Browse the original pages or review unmapped answers.</span>
        </div>
      )}

      {answer && (
        <div className="located-answer-bar">
          <LocateFixed size={15} />
          <span>Located <strong>{questionLabel}</strong> on page {answer.regions[activeRegionIndex]?.pageNumber}</span>
          <span>{Math.round(answer.regions[activeRegionIndex]?.confidence * 100)}% region confidence</span>
        </div>
      )}

      <div className="viewer-viewport" ref={viewportRef}>
        <div className="viewer-scroll" ref={viewerRef}>
          {isDemo ? (
            <div className="page-wrapper" style={{ width: pageWidth }}>
              <DemoAnswerPage pageNumber={currentPage} answers={assessment.answers} />
              <RegionOverlay answer={answer} pageNumber={currentPage} label={questionLabel} />
            </div>
          ) : pdfFile ? (
            <PdfDocumentPage
              file={pdfFile}
              pageNumber={currentPage}
              width={pageWidth}
              onRendered={() => setRenderVersion((version) => version + 1)}
              onPageCount={(numPages) => currentPage > numPages && setCurrentPage(1)}
            >
              <RegionOverlay answer={answer} pageNumber={currentPage} label={questionLabel} />
            </PdfDocumentPage>
          ) : imageUrls.length ? (
            <div className="page-wrapper image-page-wrapper" style={{ width: pageWidth }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrls[currentPage - 1]} alt={`Answer sheet page ${currentPage}`} onLoad={() => setRenderVersion((version) => version + 1)} />
              <RegionOverlay answer={answer} pageNumber={currentPage} label={questionLabel} />
            </div>
          ) : (
            <div className="document-error"><FileWarning size={22} /> The original answer-sheet file is no longer available in this session.</div>
          )}
        </div>
      </div>
    </section>
  );
}
