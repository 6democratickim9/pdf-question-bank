export const QUESTION_START = /^\s*(?:Question\s+|Q\.?\s*)?(\d{1,5})\s*[.:)]?\s*(.*)$/i;
export const EXPLICIT_QUESTION_START = /^\s*(?:Question\s+|Q\.?\s*)(\d{1,5})\s*[.:)]?\s*(.*)$/i;
export const NUMBERED_QUESTION_START = /^\s*(\d{1,5})[.)]\s+(.+)$/;
export const CHOICE_START = /^\s*([A-H])\s*[.):]\s*(.*)$/i;
export const ANSWER_START = /^\s*(?:Correct\s+Answers?|Answers?)\s*:\s*(.+)$/i;
export const EXPLANATION_START = /^\s*(?:Explanation|Solution|Rationale)\s*:?[ \t]*(.*)$/i;
export const PAGE_NOISE = /^\s*(?:Page\s+\d+|\d+\s+of\s+\d+)\s*$/i;
