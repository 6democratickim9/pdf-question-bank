# PDF Question Bank

브라우저 안에서 PDF 문제집을 분석하고 시험·오답노트를 관리하는 로컬 우선 React 앱입니다. PDF와 문제 내용은 외부 서버로 전송되지 않으며 모든 진행 상황은 IndexedDB에 저장됩니다.

## 시작하기

```bash
npm install
npm run dev
```

검증 명령은 `npm run typecheck`, `npm test`, `npm run build`입니다.

## 지원 형식

- 문제: `Question 1`, `Q1`, `Q. 1`, `1.`
- 선택지: `A.`, `A)`, `A:`
- 정답: `Correct Answer: B`, `Correct Answers: B, D`, `Answer: B,D`
- 해설: `Explanation`, `Solution`, `Rationale`

스캔 이미지만 포함된 PDF는 OCR을 제공하지 않으므로 텍스트 추출이 불가능합니다.
