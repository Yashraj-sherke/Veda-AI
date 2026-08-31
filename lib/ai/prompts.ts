export const QUESTION_EXTRACTION_PROMPT = `
You are extracting questions from an assessment paper. Return JSON only.

Rules:
- Extract every real question in its printed order, including low-confidence questions.
- Preserve the printed number exactly. Never renumber or invent a number.
- Treat labelled sub-parts such as 11(a), 11(b), 12(i), and 12(ii) as independent questions.
- Join multi-line and cross-page question text without changing its meaning.
- Exclude instructions, section headings, headers, footers, worked examples, and marks-only labels.
- Include marks only when they are visibly associated with that question.
- For multi-image documents, use the supplied "Document page N" markers as page numbers.
- pageNumber is one-based. confidence is 0 to 1.

Shape: {"questions":[{"originalNumber":"11(a)","text":"...","pageNumber":2,"marks":5,"confidence":0.96}]}
`;

export const ANSWER_EXTRACTION_PROMPT = `
You are reading a student's handwritten answer sheet. Return JSON only.

Rules:
- Read every distinct answer faithfully; do not correct or invent the student's words.
- Record the visible question label when present, preserving it as written. Use null when absent.
- Treat answers written out of order independently.
- For each answer, return the exact tight visual region containing the answer, not the whole page.
- If an answer continues elsewhere or across pages, include every region in the same answer.
- Coordinates x, y, width, height must be normalized from 0 to 1 relative to that page.
- For multi-image documents, use the supplied "Document page N" markers as page numbers.
- pageNumber is one-based. Include extraction and region confidence from 0 to 1.
- Keep stray notes or unknown labels as answers so they can be shown as unmapped.

Shape: {"answers":[{"detectedLabel":"Q.11(a)","text":"...","confidence":0.9,"regions":[{"pageNumber":2,"x":0.1,"y":0.2,"width":0.8,"height":0.25,"confidence":0.94}]}]}
`;

export function mappingPrompt(payload: unknown) {
  return `
Map extracted answers to printed questions and make a cautious heuristic grading estimate. Return JSON only.

Rules:
- Prefer explicit question-number matches, including formatting variants.
- Answers may be out of order.
- Use semantic meaning only where numbering is missing or invalid.
- Respect sub-parts as independent questions.
- Consider nearby page/sequence context as a weak signal only.
- Never force a weak match. Use uncertain below 0.70 and unmapped when no reliable question exists.
- Each answer can map to at most one question. A question can have at most one answer record here.
- Preserve every unanswered question by simply leaving it without a mapped decision.
- Scores are AI estimates, must not exceed visible question marks, and may be omitted.
- Feedback must be one short, useful sentence grounded in the answer.
- High-confidence deterministic label matches in the input should normally be preserved.

Shape: {"decisions":[{"questionNumber":"11(a)","answerId":"answer-4","confidence":0.97,"status":"mapped","score":4,"evaluation":"partially_correct","feedback":"...","reasoning":"Visible label match."}]}

INPUT:
${JSON.stringify(payload)}
`;
}
