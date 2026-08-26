// @vitest-environment node
/**
 * Payee matching decides whether two rows describe the same party. Over-matching
 * merges two real, distinct recipients into one — which, on a funds flow, means
 * money routed to the wrong account. These tests exist to keep the normaliser
 * from getting "helpfully" more aggressive over time.
 */
import { describe, it, expect } from 'vitest';
import { normalizePayee, samePayee, accountFingerprint, toCents } from '../entity-match.ts';

describe('normalizePayee', () => {
  it('treats legal-form and punctuation variants as one party', () => {
    expect(samePayee('Apex Advisory, LLC', 'Apex Advisory LLC')).toBe(true);
    expect(samePayee('Apex Advisory L.L.C.', 'Apex Advisory, L.L.C.')).toBe(true);
    expect(samePayee('  APEX   ADVISORY llc ', 'Apex Advisory, L.L.C.')).toBe(true);
    expect(samePayee('Northgate Bank, Inc.', 'Northgate Bank Incorporated')).toBe(true);
  });

  it('does NOT merge distinct entities that share a first word', () => {
    // "Holdings" and "Capital" are not noise words. Stripping them routes the
    // seller's escrow to the sponsor's operating account.
    expect(samePayee('Meridian Holdings LLC', 'Meridian Capital LLC')).toBe(false);
    expect(samePayee('Apex Partners LP', 'Apex Ventures LP')).toBe(false);
    expect(samePayee('Greenfield Solar Inc.', 'Greenfield Wind Inc.')).toBe(false);
  });

  it('is not fooled by empty or junk input', () => {
    expect(normalizePayee('')).toBe('');
    expect(samePayee('', '')).toBe(false);
    expect(samePayee('LLC', 'Inc')).toBe(false);
  });
});

describe('accountFingerprint', () => {
  it('two rows for the same account fingerprint alike', () => {
    const a = { bank_name: 'Northgate Bank', routing_number: '021000021', account_number_last4: '4417' };
    const b = { bank_name: 'northgate  bank', routing_number: '021000021', account_number_last4: '4417' };
    expect(accountFingerprint(a)).toBe(accountFingerprint(b));
  });

  it('a changed account number changes the fingerprint', () => {
    const a = { bank_name: 'Northgate Bank', routing_number: '021000021', account_number_last4: '4417' };
    const b = { bank_name: 'Northgate Bank', routing_number: '021000021', account_number_last4: '9902' };
    expect(accountFingerprint(a)).not.toBe(accountFingerprint(b));
  });
});

describe('toCents', () => {
  it('parses the formats a funds flow actually contains', () => {
    expect(toCents('$1,234.56')).toBe(123456);
    expect(toCents('1234.56')).toBe(123456);
    expect(toCents(1234.56)).toBe(123456);
    expect(toCents('185,000,000')).toBe(18_500_000_000);
  });

  it('does not lose a cent to floating point', () => {
    expect(toCents('0.07')).toBe(7);
    expect(toCents('1.005')).toBe(101);   // rounds, does not truncate to 100
    expect(toCents('77700000.10')).toBe(7_770_000_010);
  });

  it('handles the messier strings an extractor returns', () => {
    expect(toCents('1,234.56 USD')).toBe(123456);
    expect(toCents('€1.234,56'.replace('.', '').replace(',', '.'))).toBe(123456);
    expect(toCents('(1,234.56)')).toBe(-123456);   // accounting negative
    expect(toCents('-1234.56')).toBe(-123456);
    expect(toCents('$185,000,000.00')).toBe(18_500_000_000);
  });

  it('the number and string paths agree', () => {
    for (const n of [0, 0.01, 1234.56, 77_700_000.1, 185_000_000]) {
      expect(toCents(n)).toBe(toCents(String(n)));
    }
  });

  it('treats unparseable amounts as zero rather than NaN', () => {
    expect(toCents('')).toBe(0);
    expect(toCents('TBD')).toBe(0);
    expect(toCents(null as never)).toBe(0);
  });
});
