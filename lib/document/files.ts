import type { UploadedDocument } from "@/types/assessment";

export const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_PAGES = 30;

export function validateFiles(files: File[]): string | null {
  if (!files.length) return "Choose a PDF or one or more image files.";
  if (files.length > MAX_IMAGE_PAGES) return `Use no more than ${MAX_IMAGE_PAGES} image pages.`;
  if (files.some((file) => !ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number]))) {
    return "That file type is not supported. Use PDF, PNG, JPG, or JPEG.";
  }
  if (files.some((file) => file.size > MAX_FILE_BYTES)) {
    return "Each file must be 50 MB or smaller.";
  }
  if (files.some((file) => file.type === "application/pdf") && files.length > 1) {
    return "Upload one PDF, or select multiple image pages—not both.";
  }
  return null;
}

async function estimatePdfPages(file: File): Promise<number> {
  try {
    const buffer = await file.arrayBuffer();
    const text = new TextDecoder("latin1").decode(buffer);
    const matches = text.match(/\/Type\s*\/Page\b/g);
    return Math.max(1, matches?.length ?? 1);
  } catch {
    return 1;
  }
}

export async function createUploadedDocument(files: File[]): Promise<UploadedDocument> {
  const isPdf = files[0]?.type === "application/pdf";
  const pageCount = isPdf ? await estimatePdfPages(files[0]) : files.length;
  return {
    files,
    displayName: files.length === 1 ? files[0].name : `${files.length} image pages`,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    pageCount,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
