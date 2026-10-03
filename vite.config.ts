import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const statePath = resolve('data/pdf-question-bank-state.json');
const emptyState = () => ({ version: 1, questionBanks: [], examSessions: [], cycleResults: [], wrongAnswers: [], statistics: [], wrongHistory: [], bookmarks: [] });

function jsonStatePlugin() {
  return {
    name: 'local-json-state',
    configureServer(server: { middlewares: { use: (handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse, next: () => void) => void) => void } }) {
      server.middlewares.use(async (request, response, next) => {
        const path = request.url?.split('?')[0]; if (path !== '/pdf-question-bank/api/state' && path !== '/api/state') return next();
        response.setHeader('content-type', 'application/json; charset=utf-8');
        try {
          if (request.method === 'GET') {
            let text: string; try { text = await readFile(statePath, 'utf8'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; text = JSON.stringify(emptyState(), null, 2); }
            response.statusCode = 200; response.end(text); return;
          }
          if (request.method === 'PUT') {
            const chunks: Buffer[] = []; let size = 0;
            for await (const chunk of request) { const buffer = Buffer.from(chunk); size += buffer.length; if (size > 100 * 1024 * 1024) throw new Error('JSON 상태 파일이 100MB 제한을 초과했습니다.'); chunks.push(buffer); }
            const text = Buffer.concat(chunks).toString('utf8'); const parsed = JSON.parse(text);
            if (parsed.version !== 1 || !Array.isArray(parsed.questionBanks)) throw new Error('올바른 문제은행 JSON 상태가 아닙니다.');
            await mkdir(dirname(statePath), { recursive: true }); const temporary = `${statePath}.tmp`; await writeFile(temporary, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8'); await rename(temporary, statePath);
            response.statusCode = 200; response.end(JSON.stringify({ ok: true })); return;
          }
          response.statusCode = 405; response.end(JSON.stringify({ error: 'Method not allowed' }));
        } catch (error) { response.statusCode = 500; response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown JSON storage error' })); }
      });
    },
  };
}

export default defineConfig({
  base: '/pdf-question-bank/',
  plugins: [react(), jsonStatePlugin()],
  test: { environment: 'node' },
});
