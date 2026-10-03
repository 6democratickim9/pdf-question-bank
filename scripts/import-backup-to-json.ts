import { readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const inputPath = resolve(process.argv[2] ?? '');
const outputPath = resolve(process.argv[3] ?? 'data/pdf-question-bank-state.json');
if (!process.argv[2]) throw new Error('Usage: npm run state:import -- /path/to/backup.pqb-backup');

const source = await readFile(inputPath);
let imported: Record<string, unknown>;
if (source.subarray(0, 4).toString('utf8') === 'PQB1') {
  const headerLength = source.readUInt32LE(4);
  const backup = JSON.parse(source.subarray(8, 8 + headerLength).toString('utf8'));
  imported = backup.data;
} else {
  const parsed = JSON.parse(source.toString('utf8'));
  imported = parsed.format === 'pdf-question-bank-backup' ? parsed.data : parsed;
}

const keys = ['questionBanks', 'examSessions', 'cycleResults', 'wrongAnswers', 'statistics', 'wrongHistory', 'bookmarks'] as const;
if (!keys.every((key) => Array.isArray(imported[key]))) throw new Error('지원하는 문제은행 백업이 아닙니다.');
const state = {
  version: 1,
  ...Object.fromEntries(keys.map((key) => [key, imported[key]])),
  questionBanks: (imported.questionBanks as Array<Record<string, unknown>>).map(({ sourcePdf: _sourcePdf, ...bank }) => bank),
};
const temporaryPath = `${outputPath}.tmp`;
await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
await rename(temporaryPath, outputPath);
console.log(JSON.stringify({ outputPath, questionBanks: state.questionBanks.length, sessions: (state.examSessions as unknown[]).length, results: (state.cycleResults as unknown[]).length }, null, 2));
