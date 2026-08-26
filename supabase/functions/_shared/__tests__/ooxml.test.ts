// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractOoxml, isOoxml } from '../ooxml.ts';
import { extractDocumentText } from '../extract-text.ts';

const S = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const xlsx = new Uint8Array(fs.readFileSync(`${S}/captable.xlsx`));
const docx = new Uint8Array(fs.readFileSync(`${S}/spa.docx`));

describe('XLSX', () => {
  it('reads every sheet in workbook order', async () => {
    const r = await extractOoxml(xlsx, 'captable.xlsx');
    expect(r.sheets).toEqual(['Summary', 'Cap Table', 'Sparse']);
  });

  it('renders percentages as percentages, not as 0.42', async () => {
    const r = await extractOoxml(xlsx, 'captable.xlsx');
    expect(r.text).toContain('42%');
    expect(r.text).not.toMatch(/\t0\.42\t/);
  });

  it('renders dates as dates, not as a serial number', async () => {
    const r = await extractOoxml(xlsx, 'captable.xlsx');
    expect(r.text).toContain('2026-03-14');
    expect(r.text).not.toContain('46095');
  });

  it('keeps column positions when cells are blank', async () => {
    const r = await extractOoxml(xlsx, 'captable.xlsx');
    const line = r.text.split('\n').find((l) => l.includes('ACH-99120'))!;
    expect(line.split('\t')).toEqual(['Wire Ref', '', 'ACH-99120', '', 'Confirmed']);
  });

  it('keeps the two Meridian entities distinct', async () => {
    const r = await extractOoxml(xlsx, 'captable.xlsx');
    expect(r.text).toContain('Meridian Holdings LLC');
    expect(r.text).toContain('Meridian Capital LLC');
  });

  it('rows stay on one line so a holder keeps its own numbers', async () => {
    const r = await extractOoxml(xlsx, 'captable.xlsx');
    const line = r.text.split('\n').find((l) => l.startsWith('Jane Okafor'))!;
    expect(line).toBe('Jane Okafor\tCommon\t500000\t5%\t9250000');
  });
});

describe('DOCX', () => {
  it('reads the body text', async () => {
    const r = await extractOoxml(docx, 'spa.docx');
    expect(r.text).toContain('$185,000,000');
    expect(r.text).toContain('Northgate Bank');
  });

  it('preserves paragraph breaks so sections stay separate', async () => {
    const r = await extractOoxml(docx, 'spa.docx');
    expect(r.text).toMatch(/1\.1\s+Purchase Price/);
    expect(r.text.split('\n').length).toBeGreaterThan(5);
  });

  it('reads table cells', async () => {
    const r = await extractOoxml(docx, 'spa.docx');
    expect(r.text).toContain('ops@meridian.example');
    const row = r.text.split('\n').find((l) => l.includes('ops@meridian.example'))!;
    expect(row).toContain('Meridian Holdings LLC');
  });

  it('decodes smart quotes rather than leaving entities', async () => {
    const r = await extractOoxml(docx, 'spa.docx');
    expect(r.text).not.toContain('&#');
    expect(r.text).not.toContain('&amp;');
  });
});

describe('guards', () => {
  it('isOoxml only claims real zip-backed Office files', () => {
    expect(isOoxml('a.xlsx', xlsx)).toBe(true);
    expect(isOoxml('a.pdf', new Uint8Array([0x25, 0x50]))).toBe(false);
    expect(isOoxml('a.xlsx', new Uint8Array([0x25, 0x50]))).toBe(false);
  });

  it('a truncated archive fails loudly', async () => {
    await expect(extractOoxml(xlsx.subarray(0, 400), 'x.xlsx')).rejects.toThrow();
  });
});

describe('nested tables', () => {
  const nested = new Uint8Array(fs.readFileSync(`${S}/nested.docx`));

  it('a table inside a cell does not splice the outer table into running text', async () => {
    const r = await extractOoxml(nested, 'nested.docx');
    expect(r.text.startsWith('Schedule 3.6 — Required Consents')).toBe(true);
    expect(r.text.trimEnd().endsWith('End of Schedule 3.6.')).toBe(true);
    expect(r.text).toContain('Northgate Bank');
    expect(r.text).toContain('7.2(b)');
  });
});

describe('extractDocumentText routing', () => {
  const store = (buf: Uint8Array) => ({
    storage: { from: () => ({ download: async () => ({ data: new Blob([buf]), error: null }) }) },
  }) as any;

  it('routes .xlsx to the Office reader', async () => {
    const r = await extractDocumentText(store(xlsx), 'p/captable.xlsx', 'captable.xlsx', {});
    expect(r.method).toBe('office_xml');
    expect(r.text).toContain('Meridian Holdings LLC');
  });

  it('routes .docx to the Office reader', async () => {
    const r = await extractDocumentText(store(docx), 'p/spa.docx', 'spa.docx', {});
    expect(r.method).toBe('office_xml');
    expect(r.problem).toBeUndefined();
  });

  it('legacy .xls gets an actionable message, not "unsupported file type"', async () => {
    // OLE compound-file magic — what a real .xls starts with.
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(600).fill(0)]);
    const r = await extractDocumentText(store(ole), 'p/old.xls', 'old.xls', {});
    expect(r.problem).toMatch(/re-save/i);
  });

  it('a corrupt .xlsx explains itself instead of returning empty text', async () => {
    const broken = new Uint8Array(xlsx); broken.set([0x50, 0x4b, 0x03, 0x04], 0);
    broken.fill(0, 2000, 3000);
    const r = await extractDocumentText(store(broken), 'p/broken.xlsx', 'broken.xlsx', {});
    expect(r.quality).toBe(0);
    expect(r.problem).toBeTruthy();
  });
});
