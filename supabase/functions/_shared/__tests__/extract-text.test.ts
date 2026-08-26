// @vitest-environment node
/**
 * The vision fallback is the only path in this system that can make an
 * arbitrarily expensive request, and nothing above it enforces a budget.
 */
import { describe, it, expect } from 'vitest';
import { extractDocumentText } from '../extract-text.ts';

/** Scan-shaped PDF: a valid header and page objects, but no text operators. */
function fakeScan(mb: number, pages: number) {
  return new Blob(['%PDF-1.4\n' + '/Type /Page \n'.repeat(pages) + 'x'.repeat(mb * 1024 * 1024)]);
}
const store = (blob: Blob) =>
  ({ storage: { from: () => ({ download: async () => ({ data: blob, error: null }) }) } }) as never;

describe('vision fallback cost guards', () => {
  it('refuses an oversized scan and names the limit', async () => {
    const r = await extractDocumentText(store(fakeScan(10, 5)), 'huge.pdf', 'huge.pdf', { apiKey: 'k' });
    expect(r.problem).toMatch(/too large to transcribe/i);
    expect(r.problem).toMatch(/8MB and 30 pages/);
    expect(r.quality).toBe(0);
  });

  it('refuses a scan with too many pages', async () => {
    const r = await extractDocumentText(store(fakeScan(1, 200)), 'long.pdf', 'long.pdf', { apiKey: 'k' });
    expect(r.problem).toMatch(/too large to transcribe/i);
  });

  it('a small scan is still eligible for transcription', async () => {
    const r = await extractDocumentText(store(fakeScan(1, 3)), 'small.pdf', 'small.pdf', { apiKey: null });
    expect(r.problem).not.toMatch(/too large/i);
    expect(r.problem).toMatch(/no readable text layer/i);
  });
});

describe('failure reporting', () => {
  it('a missing file says so rather than returning empty text', async () => {
    const admin = { storage: { from: () => ({ download: async () => ({ data: null, error: { message: 'Object not found' } }) }) } } as never;
    const r = await extractDocumentText(admin, 'gone.pdf', 'gone.pdf', {});
    expect(r.method).toBe('none');
    expect(r.problem).toContain('Object not found');
  });

  it('plain text passes through', async () => {
    const body = 'Section 1.1 Purchase Price. '.repeat(20);
    const r = await extractDocumentText(store(new Blob([body])), 'a.txt', 'a.txt', {});
    expect(r.method).toBe('plain_text');
    expect(r.quality).toBe(1);
  });
});
