// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('threshold overrides', () => {
  const original = (globalThis as Record<string, unknown>).Deno;
  const setEnv = (env: Record<string, string>) => {
    (globalThis as Record<string, unknown>).Deno = { env: { get: (k: string) => env[k] } };
  };
  beforeEach(() => vi.resetModules());
  afterEach(() => { (globalThis as Record<string, unknown>).Deno = original; });

  it('uses the documented defaults when nothing is set', async () => {
    setEnv({});
    const { THRESHOLDS } = await import('../thresholds.ts');
    expect(THRESHOLDS.minUsefulChars).toBe(200);
    expect(THRESHOLDS.autoVerifyConfidence).toBe(0.8);
    expect(THRESHOLDS.visionMaxPages).toBe(30);
  });

  it('an environment variable moves a threshold without a code change', async () => {
    setEnv({ PIVT_AUTO_VERIFY_CONFIDENCE: '0.95', PIVT_VISION_MAX_PAGES: '5' });
    const { THRESHOLDS } = await import('../thresholds.ts');
    expect(THRESHOLDS.autoVerifyConfidence).toBe(0.95);
    expect(THRESHOLDS.visionMaxPages).toBe(5);
  });

  it('a non-numeric value warns and keeps the default rather than becoming NaN', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv({ PIVT_MIN_USEFUL_CHARS: 'lots' });
    const { THRESHOLDS } = await import('../thresholds.ts');
    expect(THRESHOLDS.minUsefulChars).toBe(200);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logThresholdDecision emits parseable JSON with the decision inputs', async () => {
    setEnv({});
    const { logThresholdDecision } = await import('../thresholds.ts');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    logThresholdDecision('auto_verify', 0.91, 0.8, 'verified', { requirement_id: 'r1' });
    const line = JSON.parse(log.mock.calls[0][0] as string);
    expect(line).toMatchObject({
      event: 'threshold_decision', gate: 'auto_verify',
      confidence: 0.91, threshold: 0.8, passed: true,
      outcome: 'verified', requirement_id: 'r1',
    });
    log.mockRestore();
  });
});
