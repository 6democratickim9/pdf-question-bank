import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/pdf-question-bank/',
  plugins: [react()],
  test: { environment: 'node' },
});
