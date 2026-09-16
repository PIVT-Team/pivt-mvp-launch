// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { composeRequirementMessage, LINK_PLACEHOLDER } from '../requirement-message.ts';

const LINK = 'https://pivt.tools/submit?t=abc123';

describe('composeRequirementMessage', () => {
  it('substitutes the placeholder', () => {
    const m = composeRequirementMessage({ body: `Hi,\n${LINK_PLACEHOLDER}\nThanks`, link: LINK, requirementTitle: 'W-9' });
    expect(m.body).toContain(LINK);
    expect(m.body).not.toContain(LINK_PLACEHOLDER);
    expect(m.linkAppended).toBe(false);
  });

  it('an empty body still carries the link — the old code sent an email with none', () => {
    const m = composeRequirementMessage({ body: '', link: LINK, requirementTitle: 'Board consent', recipientName: 'Jane Okafor', dealName: 'Greenfield' });
    expect(m.body).toContain(LINK);
    expect(m.body).toContain('Dear Jane Okafor');
    expect(m.body).toContain('Greenfield');
    expect(m.subject).toBe('Document request — Board consent');
  });

  it('a reviewer who deleted the placeholder still sends a usable email', () => {
    const m = composeRequirementMessage({ body: 'Please send the signed page by Friday.', link: LINK, requirementTitle: 'x' });
    expect(m.body).toContain(LINK);
    expect(m.linkAppended).toBe(true);
  });

  it('does not duplicate a link the reviewer pasted in themselves', () => {
    const m = composeRequirementMessage({ body: `See ${LINK}`, link: LINK, requirementTitle: 'x' });
    expect(m.body.split(LINK).length - 1).toBe(1);
    expect(m.linkAppended).toBe(false);
  });

  it('replaces every occurrence, not just the first', () => {
    const m = composeRequirementMessage({ body: `${LINK_PLACEHOLDER} and again ${LINK_PLACEHOLDER}`, link: LINK, requirementTitle: 'x' });
    expect(m.body.split(LINK).length - 1).toBe(2);
  });

  it('keeps a supplied subject', () => {
    expect(composeRequirementMessage({ subject: 'Custom', body: 'b', link: LINK, requirementTitle: 'x' }).subject).toBe('Custom');
  });
});
