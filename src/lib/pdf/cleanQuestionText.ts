const LEADING_EXAM_CODE = /^\s*[A-Z]{2,8}-[A-Z]*\d{2,4}\b[\s:–—-]*/;

export function cleanQuestionText(text: string): string {
  return text.replace(LEADING_EXAM_CODE, '').trim();
}
