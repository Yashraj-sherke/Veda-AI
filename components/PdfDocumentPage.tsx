"use client";

import { Document, Page, pdfjs } from "react-pdf";
import { FileWarning, ScanLine } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

export function PdfDocumentPage({
  file,
  pageNumber,
  width,
  onRendered,
  onPageCount,
  children,
}: {
  file: File;
  pageNumber: number;
  width: number;
  onRendered: () => void;
  onPageCount: (pageCount: number) => void;
  children: React.ReactNode;
}) {
  return (
    <Document
      file={file}
      loading={<div className="document-loading"><ScanLine size={24} /> Rendering answer sheet…</div>}
      error={<div className="document-error"><FileWarning size={22} /> We couldn&apos;t render this PDF. Try replacing it with a valid PDF or page images.</div>}
      onLoadSuccess={({ numPages }) => onPageCount(numPages)}
    >
      <div className="page-wrapper pdf-page-wrapper" style={{ width }}>
        <Page
          pageNumber={pageNumber}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={onRendered}
        >
          {children}
        </Page>
      </div>
    </Document>
  );
}
