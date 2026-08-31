"use client";

import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { createUploadedDocument, formatBytes, validateFiles } from "@/lib/document/files";
import type { UploadedDocument } from "@/types/assessment";

export function UploadZone({
  title,
  value,
  onChange,
  onError,
}: {
  title: string;
  value: UploadedDocument | null;
  onChange: (value: UploadedDocument | null) => void;
  onError: (message: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function acceptFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    const error = validateFiles(files);
    if (error) {
      onError(error);
      return;
    }
    onError(null);
    onChange(await createUploadedDocument(files));
  }

  if (value) {
    return (
      <div className="upload-zone upload-zone--ready">
        <div className="uploaded-file">
          <span className="file-icon"><FileText size={18} /></span>
          <span className="file-info">
            <strong title={value.displayName}>{value.displayName}</strong>
            <small>{formatBytes(value.totalBytes)} &nbsp;•&nbsp; {value.pageCount} {value.pageCount === 1 ? "page" : "pages"}</small>
          </span>
          <button
            type="button"
            className="remove-file"
            aria-label={`Remove ${title}`}
            onClick={() => onChange(null)}
          >
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`upload-zone ${isDragging ? "upload-zone--dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        if (event.currentTarget === event.target) setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void acceptFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        multiple
        onChange={(event) => event.target.files && void acceptFiles(event.target.files)}
      />
      <button type="button" className="upload-zone-button" onClick={() => inputRef.current?.click()}>
        <span className="upload-icon-box"><Upload size={20} /></span>
        <span className="upload-zone-title">Upload <strong className="upload-zone-title-highlight">{title}</strong></span>
        <small className="upload-zone-sub">Max 2MB • PDF, PNG, JPG</small>
      </button>
    </div>
  );
}
