import jsPDF from 'jspdf';
import JSZip from 'jszip';
import type { DealRequirement } from './requirementsService';

/**
 * Signature packet assembly.
 *
 * Feature 1 step 5: "PIVT groups signature pages by signatory and generates a
 * packet for each person."
 *
 * A signatory who signs four documents should receive ONE packet with four
 * signature pages, not four separate emails. Grouping is by person, not by
 * document — which is the whole point of the matrix.
 *
 * v1 generates signature pages from the extracted matrix rather than slicing
 * pages out of the source PDFs. Extracting a page image requires per-document
 * page coordinates we don't reliably have, and a mis-sliced page is worse than
 * a clean generated one. `source_ref.page` is printed on each sheet so the
 * signature can be matched back to the original document.
 */

export interface SignatoryPacket {
  signatoryKey: string;
  signatoryName: string;
  capacity: string | null;
  party: string | null;
  email: string | null;
  requirements: DealRequirement[];
  /** True when any row still needs a lawyer's review — packet is not sendable. */
  hasUnreviewed: boolean;
}

const norm = (s: string | null | undefined) => String(s || '').trim().toLowerCase();

/**
 * Group approved signature requirements by signatory.
 *
 * Keyed on name + capacity: the same person signing in two capacities (say as
 * CEO of the buyer and as trustee of a shareholder trust) genuinely needs two
 * signature blocks, and merging them would produce an incorrect page.
 */
export function groupBySignatory(requirements: DealRequirement[]): SignatoryPacket[] {
  const signatures = requirements.filter(
    (r) => r.requirement_kind === 'signature' &&
           !['satisfied', 'waived', 'not_required'].includes(r.status)
  );

  const byKey = new Map<string, SignatoryPacket>();
  for (const r of signatures) {
    // Unnamed signatories are grouped per party, and flagged — the extractor
    // sets ambiguity 'high' for these and a human must supply the name.
    const name = r.signatory_name?.trim() || `[Unnamed — ${r.signing_party || 'unknown party'}]`;
    const key = `${norm(name)}::${norm(r.signatory_capacity)}`;

    if (!byKey.has(key)) {
      byKey.set(key, {
        signatoryKey: key,
        signatoryName: name,
        capacity: r.signatory_capacity,
        party: r.signing_party,
        email: r.counterparty_email,
        requirements: [],
        hasUnreviewed: false,
      });
    }
    const p = byKey.get(key)!;
    p.requirements.push(r);
    if (r.review_status !== 'approved') p.hasUnreviewed = true;
  }

  return [...byKey.values()].sort((a, b) => a.signatoryName.localeCompare(b.signatoryName));
}

/** One PDF per signatory: a cover sheet plus a signature page per document. */
export function buildPacketPdf(packet: SignatoryPacket, dealName: string): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 20;

  // ── cover ──
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text('Signature Packet', M, 30);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
  doc.text(dealName, M, 39);

  doc.setDrawColor(200); doc.line(M, 45, W - M, 45);

  doc.setFontSize(10);
  let y = 56;
  const kv = (k: string, v: string) => {
    doc.setTextColor(120); doc.text(k, M, y);
    doc.setTextColor(20); doc.text(v, M + 38, y);
    y += 7;
  };
  kv('Signatory', packet.signatoryName);
  if (packet.capacity) kv('Capacity', packet.capacity);
  if (packet.party) kv('On behalf of', packet.party);
  kv('Documents', String(packet.requirements.length));

  y += 6;
  doc.setTextColor(120); doc.setFontSize(9);
  doc.text('This packet contains a signature page for each document listed below.', M, y); y += 5;
  doc.text('Please sign each page and return the complete packet.', M, y); y += 10;

  doc.setTextColor(20); doc.setFontSize(10);
  packet.requirements.forEach((r, i) => {
    const src = (r.source_ref || {}) as Record<string, string>;
    const label = src.filename || r.title;
    doc.text(`${i + 1}.`, M, y);
    doc.text(doc.splitTextToSize(label, W - M * 2 - 10) as string[], M + 8, y);
    y += 7;
    if (y > H - 40) { doc.addPage(); y = 30; }
  });

  // ── one signature page per document ──
  for (const r of packet.requirements) {
    const src = (r.source_ref || {}) as Record<string, string>;
    doc.addPage();

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.text('Signature Page', M, 30);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
    const docLine = doc.splitTextToSize(src.filename || r.title, W - M * 2) as string[];
    doc.text(docLine, M, 38);

    if (src.page || src.clause_ref) {
      doc.setFontSize(8);
      doc.text(`Corresponds to: ${src.page || src.clause_ref}`, M, 38 + docLine.length * 5 + 3);
    }

    doc.setDrawColor(220); doc.line(M, 52, W - M, 52);

    doc.setTextColor(20); doc.setFontSize(10);
    doc.text('IN WITNESS WHEREOF, the undersigned has executed this document.', M, 66);

    let sy = 92;
    if (packet.party) {
      doc.setFont('helvetica', 'bold');
      doc.text(packet.party.toUpperCase(), M, sy); sy += 14;
      doc.setFont('helvetica', 'normal');
    }

    doc.setDrawColor(60);
    doc.line(M, sy, M + 90, sy); sy += 6;
    doc.setFontSize(9); doc.setTextColor(110);
    doc.text('Signature', M, sy); sy += 16;

    doc.setTextColor(20); doc.setFontSize(10);
    doc.text(`Name:  ${packet.signatoryName.startsWith('[') ? '' : packet.signatoryName}`, M, sy); sy += 9;
    doc.text(`Title: ${packet.capacity || ''}`, M, sy); sy += 9;
    doc.text('Date:', M, sy);

    doc.setFontSize(7); doc.setTextColor(160);
    doc.text(`${dealName} · generated by PIVT · not a legal opinion`, M, H - 12);
  }

  return doc.output('blob');
}

/** All packets for a deal, zipped, one PDF per signatory. */
export async function buildAllPackets(
  requirements: DealRequirement[],
  dealName: string
): Promise<{ blob: Blob; packets: SignatoryPacket[]; skipped: SignatoryPacket[] }> {
  const all = groupBySignatory(requirements);

  // An unreviewed row means a lawyer hasn't confirmed the signatory or their
  // capacity. Putting that on a signature page — and circulating it — is
  // exactly what the review gate exists to prevent.
  const ready = all.filter((p) => !p.hasUnreviewed);
  const skipped = all.filter((p) => p.hasUnreviewed);

  const zip = new JSZip();
  for (const p of ready) {
    const safe = p.signatoryName.replace(/[^A-Za-z0-9 ._-]/g, '').trim().replace(/\s+/g, '_') || 'signatory';
    zip.file(`${safe}${p.capacity ? `_${p.capacity.replace(/[^A-Za-z0-9]/g, '')}` : ''}.pdf`,
             buildPacketPdf(p, dealName));
  }

  if (ready.length === 0) {
    zip.file('README.txt',
      'No packets were generated.\n\n' +
      'Every signature requirement on this deal is still awaiting review. ' +
      'Approve the signatory and capacity for each one, then generate again.\n');
  }

  return { blob: await zip.generateAsync({ type: 'blob' }), packets: ready, skipped };
}
