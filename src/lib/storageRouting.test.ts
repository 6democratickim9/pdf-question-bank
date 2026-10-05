import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('JSON storage routing', () => {
  it.each(['src/WrongReviewExam.tsx', 'src/StudyViews.tsx'])('%s는 구형 IndexedDB가 아닌 공유 JSON 저장소를 사용한다', async (file) => {
    const source = await readFile(resolve(file), 'utf8');
    expect(source).toContain("from './lib/jsonDb'");
    expect(source).not.toContain("from './lib/db'");
  });
});
