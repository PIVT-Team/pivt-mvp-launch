import { defineConfig } from 'vitest/config';
import path from 'path';
const HERE = '/private/tmp/claude-501/-Users-snuka-Desktop-Sai-PIVT-pivt-mvp-launch-abcef2ed-main/f3527a70-b1b8-49bb-9c5d-585f852121ce/scratchpad/stress';
export default defineConfig({
  test: { environment: 'node', globals: true, include: [path.join(HERE, 'ooxml.test.ts')] },
  resolve: { alias: { '@ff': path.resolve(__dirname, 'supabase/functions/_shared') } },
});
