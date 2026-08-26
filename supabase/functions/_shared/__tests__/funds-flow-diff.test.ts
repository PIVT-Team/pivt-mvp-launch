// @vitest-environment node
/**
 * The diff is what stands between "a new funds flow was uploaded" and a human
 * being told what changed. Its original failure — a supersede step that matched
 * nothing — doubled every payment on the deal without any visible error, which
 * is the worst possible shape for a bug in this product.
 */
import { describe, it, expect } from 'vitest';
import { diffPaymentSet, isMaterial } from '../funds-flow-diff.ts';

const wire = (over: Record<string, unknown> = {}) => ({
  payee_entity: 'Meridian Holdings LLC',
  amount: 77_700_000,
  payment_type: 'purchase_price',
  bank_name: 'Northgate Bank',
  routing_number: '021000021',
  account_number_last4: '4417',
  verification_status: 'verified',
  ...over,
}) as never;

describe('diffPaymentSet', () => {
  it('an identical re-upload changes nothing', () => {
    const d = diffPaymentSet([wire()], [wire()]);
    expect(d.unchanged).toHaveLength(1);
    expect(isMaterial(d)).toBe(false);
  });

  it('re-uploading does not duplicate payments (gap G2)', () => {
    const existing = [wire(), wire({ payee_entity: 'Apex Advisory LLC', amount: 46_250_000, payment_type: 'fees' })];
    const d = diffPaymentSet(existing, existing.map((e) => ({ ...e })));
    expect(d.added).toHaveLength(0);
    expect(d.removed).toHaveLength(0);
    expect(d.unchanged).toHaveLength(2);
  });

  it('reports an amount change with both figures', () => {
    const d = diffPaymentSet([wire()], [wire({ amount: 80_000_000 })]);
    expect(d.amountChanged).toHaveLength(1);
    expect(d.amountChanged[0].fromCents).toBe(7_770_000_000);
    expect(d.amountChanged[0].toCents).toBe(8_000_000_000);
    expect(d.bankChanged).toHaveLength(0);
  });

  it('reports a bank change and whether the old row was already verified', () => {
    const d = diffPaymentSet([wire()], [wire({ account_number_last4: '9902', routing_number: '111000025' })]);
    expect(d.bankChanged).toHaveLength(1);
    expect(d.bankChanged[0].wasVerified).toBe(true);
    expect(d.bankChanged[0].changes.map((c) => c.field).sort())
      .toEqual(['account_number_last4', 'routing_number']);
    expect(d.amountChanged).toHaveLength(0);
  });

  it('a dropped recipient is reported as removed, not silently lost', () => {
    const existing = [wire(), wire({ payee_entity: 'Jane Okafor', amount: 9_250_000, payment_type: 'proceeds' })];
    const d = diffPaymentSet(existing, [wire()]);
    expect(d.removed).toHaveLength(1);
    expect(d.removed[0].payee_entity).toBe('Jane Okafor');
    expect(isMaterial(d)).toBe(true);
  });

  it('catches the same payee billed twice inside one document', () => {
    const d = diffPaymentSet([], [wire({ payment_type: 'fees' }), wire({ payment_type: 'fees' })]);
    expect(d.duplicatesInIncoming).toHaveLength(1);
    expect(d.duplicatesInIncoming[0].rows).toHaveLength(2);
  });

  it('keeps two distinct Meridian entities apart', () => {
    const existing = [wire()];
    const incoming = [wire(), wire({ payee_entity: 'Meridian Capital LLC', amount: 14_800_000 })];
    const d = diffPaymentSet(existing, incoming);
    // The Capital row is new; the Holdings row is unchanged. If the normaliser
    // merged them, this would read as one row whose amount changed.
    expect(d.added.map((a) => a.payee_entity)).toEqual(['Meridian Capital LLC']);
    expect(d.unchanged).toHaveLength(1);
    expect(d.amountChanged).toHaveLength(0);
  });

  it('a version that omits bank fields is not read as blanking them', () => {
    const d = diffPaymentSet([wire()], [{
      payee_entity: 'Meridian Holdings LLC', amount: 77_700_000, payment_type: 'purchase_price',
    } as never]);
    expect(d.bankChanged).toHaveLength(0);
    expect(d.unchanged).toHaveLength(1);
  });

  it('two payments to the same payee under different types stay separate', () => {
    const existing = [wire({ payment_type: 'purchase_price' }), wire({ payment_type: 'escrow', amount: 18_500_000 })];
    const d = diffPaymentSet(existing, existing.map((e) => ({ ...e })));
    expect(d.unchanged).toHaveLength(2);
    expect(d.removed).toHaveLength(0);
  });

  it('string amounts with currency formatting compare correctly', () => {
    const d = diffPaymentSet([wire({ amount: 77_700_000 })], [wire({ amount: '$77,700,000.00' })]);
    expect(d.amountChanged).toHaveLength(0);
    expect(d.unchanged).toHaveLength(1);
  });
});
