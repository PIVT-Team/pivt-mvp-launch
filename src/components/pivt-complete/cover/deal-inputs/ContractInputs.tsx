import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { FileText } from 'lucide-react';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { DealDocumentUploader } from './DealDocumentUploader';

const CONTRACT_DOC_TYPES = [
  { value: 'SPA', label: 'SPA / Merger Agreement' },
  { value: 'DISCLOSURE_SCHEDULES', label: 'Disclosure Schedules' },
  { value: 'ESCROW_AGREEMENT', label: 'Escrow Agreement' },
  { value: 'SIDE_LETTER', label: 'Side Letters' },
  { value: 'TSA', label: 'Transition Service Agreements' },
  { value: 'EARNOUT', label: 'Earn-out Agreements' },
] as const;

export const ContractInputs: React.FC = () => {
  const { dealId, isDemoDeal } = useDealWorkspace();

  return (
    <div className="space-y-8">
      <motion.div {...fadeInUp}>
        <h2 className="text-xl font-semibold" style={{ letterSpacing: '-0.03em' }}>Contract Documents</h2>
        <p className="text-sm text-muted-foreground mt-1">Core transaction agreements — parsed by AI for obligations.</p>
      </motion.div>

      <DealDocumentUploader
        dealId={dealId}
        isDemoDeal={isDemoDeal}
        docTypes={CONTRACT_DOC_TYPES}
        icon={<FileText className="w-5 h-5 text-accent" />}
        title="Upload Agreements"
        description="Upload core transaction documents. Supported formats: PDF, DOC, DOCX."
        emptyStateText="No contract documents uploaded."
      />
    </div>
  );
};
