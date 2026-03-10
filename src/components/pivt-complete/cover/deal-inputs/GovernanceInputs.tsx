import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { ShieldCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { DealDocumentUploader } from './DealDocumentUploader';

const GOV_DOC_TYPES = [
  { value: 'BOARD_RESOLUTION', label: 'Board Resolution' },
  { value: 'SHAREHOLDER_APPROVAL', label: 'Shareholder Approval' },
  { value: 'WRITTEN_CONSENT', label: 'Written Consent' },
  { value: 'OFFICER_CERTIFICATE', label: 'Officer Certificate' },
] as const;

export const GovernanceInputs: React.FC = () => {
  const { dealId, isDemoDeal } = useDealWorkspace();

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Governance</h2>
        <p className="text-sm text-muted-foreground mt-1">Corporate approvals required before closing.</p>
      </motion.div>

      <DealDocumentUploader
        dealId={dealId}
        isDemoDeal={isDemoDeal}
        docTypes={GOV_DOC_TYPES}
        icon={<ShieldCheck className="w-5 h-5 text-violet-500" />}
        title="Governance Documents"
        description="Upload board resolutions, shareholder approvals, and other corporate governance documents."
        emptyStateText="No governance documents uploaded."
      />

      {/* Structured Governance Inputs */}
      <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <div className="flex items-center gap-3"><ShieldCheck className="w-5 h-5 text-accent" /><h3 className="font-semibold">Approval Records</h3></div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div><Label className="text-xs text-muted-foreground">Approval Type</Label>
            <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5">
              <option>Board Resolution</option><option>Shareholder Vote</option><option>Written Consent</option><option>Officer Certificate</option>
            </select>
          </div>
          <div><Label className="text-xs text-muted-foreground">Approving Entity</Label><Input placeholder="Board of Directors" className="mt-1.5" /></div>
          <div><Label className="text-xs text-muted-foreground">Approval Date</Label><Input type="date" className="mt-1.5" /></div>
        </div>
      </motion.div>
    </div>
  );
};
