import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { useKycStore } from '@/stores/kycStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { Shield, FileCheck, Users, AlertTriangle, TrendingUp, Clock, Plus } from 'lucide-react';
import { NewtonInsights } from './NewtonInsights';
import pivtLogo from '@/assets/pivt-logo.png';
import { ActivityFeed } from './ActivityFeed';
import { KycGateModal } from '@/components/deal-wizard/KycGateModal';

export const CommandCenterCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, payments, pendingApprovals, setActiveSection } = usePIVTStore();
  const { openWizard, setWizardMode, prefillDemo } = useDealWizardStore();
  const { userKyc, orgKyb, fetchKycData } = useKycStore();
  const [showGate, setShowGate] = useState(false);

  useEffect(() => { fetchKycData(); }, []);

  const handleNewDeal = () => {
    // Check if KYC/KYB is approved for live deals
    const kycApproved = userKyc?.status === 'approved';
    const kybApproved = orgKyb?.status === 'approved';
    if (!kycApproved || !kybApproved) {
      setShowGate(true);
    } else {
      openWizard();
    }
  };

  const stats = [
    { label: 'Deal Value', value: `$${(deal.consideration / 1e9).toFixed(1)}B`, icon: TrendingUp, color: 'text-accent' },
    { label: 'Recipients', value: deal.totalRecipients, icon: Users, color: 'text-accent/70' },
    { label: 'Documents', value: deal.documentsUploaded, icon: FileCheck, color: 'text-validated' },
    { label: 'Ready to Pay', value: `${deal.readyToPayPercent}%`, icon: Shield, color: 'text-accent' },
    { label: 'Discrepancies', value: deal.discrepanciesFound, icon: AlertTriangle, color: 'text-discrepancy' },
    { label: 'Pending Approvals', value: pendingApprovals.length, icon: Clock, color: 'text-orange-400' },
  ];

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src={pivtLogo} alt="PIVT" className="h-14 w-14 object-contain rounded-full" style={{ filter: 'drop-shadow(0 0 8px hsl(262 72% 55% / 0.5))' }} />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{deal.name}</h1>
            <p className="text-muted-foreground mt-1">{deal.buyerName} acquiring {deal.targetCompany} · {deal.sector}</p>
          </div>
        </div>
        <button
          onClick={handleNewDeal}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-semibold hover:bg-accent/90 transition-all"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'View Waterfall', section: 'waterfall' as const },
          { label: 'Review Approvals', section: 'approvals' as const },
          { label: 'Check Escrow', section: 'escrow' as const },
          { label: 'Portfolio Analytics', section: 'reports' as const },
        ].map(action => (
          <button
            key={action.label}
            onClick={() => setActiveSection(action.section)}
            className="pivt-card p-3 text-sm font-medium text-center hover:border-accent/50 hover:text-accent transition-colors"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4 hover:shadow-md transition-shadow cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-xs text-muted-foreground">{stat.label}</span>
            </div>
            <p className="pivt-stat text-xl">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Readiness Bar */}
      <motion.div {...fadeInUp} className="pivt-card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Closing Readiness</h3>
          <span className="font-mono text-accent font-semibold">{deal.readyToPayPercent}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <motion.div
            className="bg-accent h-3 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${deal.readyToPayPercent}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2 cursor-pointer hover:text-accent transition-colors" onClick={() => setActiveSection('stakeholders')}>
            <div className="w-2 h-2 rounded-full bg-validated" />
            <span>{stakeholders.filter(s => s.kycStatus === 'verified').length} KYC Verified</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer hover:text-accent transition-colors" onClick={() => setActiveSection('documents')}>
            <div className="w-2 h-2 rounded-full bg-validated" />
            <span>{documents.filter(d => d.status === 'verified').length} Docs Verified</span>
          </div>
          <div className="flex items-center gap-2 cursor-pointer hover:text-accent transition-colors" onClick={() => setActiveSection('approvals')}>
            <div className="w-2 h-2 rounded-full bg-discrepancy" />
            <span>{pendingApprovals.length} Pending Approvals</span>
          </div>
        </div>
      </motion.div>

      {/* Newton Insights + Activity Feed side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <NewtonInsights />
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-5 max-h-[500px] overflow-y-auto">
          <ActivityFeed />
        </motion.div>
      </div>


      <KycGateModal
        open={showGate}
        onClose={() => setShowGate(false)}
        onGoToVerification={() => { setShowGate(false); setActiveSection('verification'); }}
        onCreateDemo={() => { setShowGate(false); setWizardMode('demo'); prefillDemo(); openWizard(); }}
      />
    </motion.div>
  );
};
