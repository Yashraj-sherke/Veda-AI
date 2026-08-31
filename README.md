# VedaAI Assessment Mapper

VedaAI turns a printed question paper and one handwritten answer sheet into a synchronized teacher-review workspace. Selecting a question jumps to the corresponding page and highlights the exact normalized answer region on the original document.

## Features

- PDF, PNG, JPG, and multi-image upload with type/size validation
- Printed question extraction in original order, including independent sub-questions
- Handwriting OCR with page-aware, normalized answer bounding boxes
- Hybrid answer mapping: deterministic label matching first, semantic/AI reasoning second
- Correct handling for out-of-order, unlabeled, unanswered, uncertain, and unmapped responses
- Multi-page answers with next/previous region navigation
- Exact highlight overlays that stay aligned at every zoom level
- AI-estimated grading, feedback, mapping confidence, and assessment summary
- Deterministic Demo Mode that exercises the same state model and review UI without an API key
- Responsive desktop and mobile review layouts with keyboard-accessible controls

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Use **Explore Demo** for the complete flow without configuring a model.

## Environment

Copy `.env.example` to `.env.local`. xAI is the default live provider:

```env
AI_PROVIDER=xai
XAI_MODEL=grok-4.6
XAI_API_KEY=your_server_side_key
```

To use Gemini instead, set `AI_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.6-flash`, and `GEMINI_API_KEY`. Provider keys are read only inside the server route and are never included in browser code. If the selected provider key is absent, live uploads return a clear configuration error; **Explore Demo** remains fully available without a key.

## AI architecture

```text
Document preparation
        ↓
Printed question extraction ─┐
                             ├─→ deterministic label normalization
Handwritten answer extraction┘               ↓
                                  candidate mapping + AI reasoning
                                                ↓
                                  validation + confidence scoring
                                                ↓
                                    heuristic grading + review UI
```

The `AssessmentAIProvider` interface keeps model-specific code out of UI and mapping logic. xAI uses Grok's Responses and Files APIs, while Gemini uses multimodal generation; every response is validated with Zod before it reaches application state. Explicit high-confidence label matches are locked before AI fallback so semantic reasoning cannot casually override deterministic evidence.

## Exact-region strategy

Answer regions are stored as one-based page numbers plus normalized `x`, `y`, `width`, and `height` values from 0–1. The viewer multiplies those coordinates by the rendered page dimensions, keeping overlays aligned across responsive widths and zoom levels. A single answer may contain multiple regions on multiple pages.

## Demo coverage

The built-in four-page assessment includes:

- answers written out of order;
- independent `11(a)` and `11(b)` entries;
- two unanswered questions;
- an unlabeled answer that needs review;
- an answer spanning pages 2 and 3;
- an invalid `Q14?` response shown under Unmapped Answers;
- grading estimates and per-question feedback.

## Tests

```bash
npm test
npm run lint
npm run build
```

Core tests cover question-label variants, sub-parts, out-of-order mapping, missing labels, unmapped content, and normalized bounding-box scaling/clamping.

## Deployment

The application is ready for Vercel or another Next.js host. Add `AI_PROVIDER=xai`, `XAI_API_KEY`, and optionally `XAI_MODEL` as server-side environment variables. The API route allows up to 120 seconds for document analysis; hosting platforms may impose lower request-body or execution limits, so large production workloads should use direct object-storage uploads and a background job queue.

## Assumptions

- Page numbers are one-based; region coordinates are normalized relative to the source page.
- Printed labels are the strongest mapping signal. Semantic mapping is used only when labels are absent or invalid.
- Marks are captured only when visible and reliably associated with a question.
- AI grades are heuristic estimates without a supplied rubric and always remain subordinate to the original work.
- The uploaded file remains in the current browser session so the original can be rendered alongside extracted data.

## Limitations

- Very illegible handwriting, overlapping answers, unusual page rotation, or heavily skewed scans can reduce OCR and region accuracy.
- Each uploaded document is limited to 2 MB so both documents fit within Vercel's request-size limit.
- xAI or Gemini document requests and file sizes are subject to provider and hosting limits.
- Live document analysis requires the selected provider's API key; deterministic Demo Mode remains available without one.
- A production deployment should add durable object storage, a job queue, retries with backoff, and teacher-confirmed mapping edits.
