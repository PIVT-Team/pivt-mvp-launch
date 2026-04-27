import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Copy, X, BookOpen, ChevronRight, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { springConfig } from '@/lib/animations';
import { toast } from '@/hooks/use-toast';

// v0 hardcoded ontology terms — in production these come from DB
const ONTOLOGY_TERMS = [
  {
    term_key: 'deal', display_name: 'Deal', entity_type: 'core_entity', status: 'active',
    definition: 'A single M&A transaction whose payments layer is being executed on PIVT.',
    required_fields: ['deal_id (human-readable ID)', 'name', 'currency_base', 'close_date_target', 'status'],
    relationships: ['1 Deal → many Parties', '1 Deal → many Documents', '1 Deal → many Conditions', '1 Deal → many Disbursement Intents', '1 Deal → many Approvals', '1 Deal → many Audit Events'],
    example: 'Project Atlas — Acquisition of Acme Co — Deal ID PIVT-2026-0012',
  },
  {
    term_key: 'party', display_name: 'Party', entity_type: 'core_entity', status: 'active',
    definition: 'A legal entity or individual participating in a Deal (buyer, seller, escrow agent, etc.).',
    required_fields: ['legal_name', 'party_type', 'jurisdiction'],
    relationships: ['many Parties ↔ one Deal', 'Parties may own Accounts', 'Parties have Users linked via Roles'],
    example: 'Atlas Holdings LLC (Buyer)',
  },
  {
    term_key: 'role', display_name: 'Role', entity_type: 'core_entity', status: 'active',
    definition: 'The permissioned function a User performs in a Deal context (not a job title).',
    required_fields: ['role_key', 'scope (deal/global)'],
    relationships: ['Roles map Users to Parties', 'Roles determine what users can approve/execute'],
    example: 'buyer_counsel, seller_counsel, pe_ops, escrow_operator',
  },
  {
    term_key: 'user', display_name: 'User', entity_type: 'core_entity', status: 'active',
    definition: 'An authenticated person using PIVT (always linked to an org/party for a given deal).',
    required_fields: ['email', 'name', 'auth_id'],
    relationships: ['Users have Roles per Deal', 'Users create Approvals and actions in Audit Log'],
    example: null,
  },
  {
    term_key: 'document', display_name: 'Document', entity_type: 'workflow_entity', status: 'active',
    definition: 'Any file or instrument relevant to the Deal (purchase agreement, schedules, payoff letters).',
    required_fields: ['document_type', 'status', 'source'],
    relationships: ['Documents satisfy Conditions', 'Documents may be linked to an e-sign Envelope'],
    example: 'Purchase Agreement (Executed)',
  },
  {
    term_key: 'esign_envelope', display_name: 'Envelope', entity_type: 'workflow_entity', status: 'active',
    definition: 'The e-signature container/session for one or more Documents, tracked through to completion.',
    required_fields: ['provider', 'envelope_id', 'status', 'completed_at'],
    relationships: ['One Envelope → many Documents', 'Envelope completion can satisfy Conditions'],
    example: null,
  },
  {
    term_key: 'condition', display_name: 'Condition', entity_type: 'workflow_entity', status: 'active',
    definition: 'A rule that must be satisfied before an Intent can move forward (execution gate).',
    required_fields: ['condition_key', 'condition_type', 'status', 'evidence_ref'],
    relationships: ['Conditions belong to a Deal or Intent', 'Satisfied by Documents/Approvals/Checks'],
    example: 'Docs Executed = true',
  },
  {
    term_key: 'approval', display_name: 'Approval', entity_type: 'workflow_entity', status: 'active',
    definition: 'A cryptographically attributable sign-off by a specific User in a specific Role on a specific object.',
    required_fields: ['approver_user_id', 'role_key', 'object_type', 'object_id', 'decision'],
    relationships: ['Approvals satisfy Conditions', 'Approvals unlock Intent transitions'],
    example: 'Seller Counsel approved Intent #17',
  },
  {
    term_key: 'disbursement_intent', display_name: 'Disbursement Intent', entity_type: 'workflow_entity', status: 'active',
    definition: 'A proposed payment action (who gets paid, how much, in what currency, from which account) within a Deal.',
    required_fields: ['payee_party', 'amount', 'currency', 'status', 'source_waterfall_ref'],
    relationships: ['Intents require Conditions + Approvals', 'Intents generate Settlements'],
    example: 'Pay $2.4M USD to Seller escrow account',
  },
  {
    term_key: 'settlement', display_name: 'Settlement', entity_type: 'workflow_entity', status: 'active',
    definition: 'The actual execution record of a Disbursement Intent (including timestamps, FX rate, confirmations).',
    required_fields: ['intent_id', 'executed_at', 'status', 'fx_rate_locked', 'provider_ref'],
    relationships: ['Settlement is the fact record for the Intent', 'Shows in Audit'],
    example: null,
  },
  {
    term_key: 'compliance_check', display_name: 'Compliance Check', entity_type: 'compliance_entity', status: 'active',
    definition: 'A structured risk check run prior to execution (KYC/KYB/AML/sanctions/basic fraud flags).',
    required_fields: ['check_type', 'status', 'risk_score', 'notes'],
    relationships: ['Checks can block execution if failed', 'Referenced by Discrepancy Engine'],
    example: null,
  },
  {
    term_key: 'discrepancy', display_name: 'Discrepancy', entity_type: 'compliance_entity', status: 'active',
    definition: 'A detected mismatch between expected truth and current system state that should block, warn, or require acknowledgment.',
    required_fields: ['rule_key', 'severity', 'object_type', 'object_id', 'message', 'status'],
    relationships: ['Raised by rules', 'Can gate Intent state transitions'],
    example: null,
  },
  {
    term_key: 'audit_event', display_name: 'Audit Event', entity_type: 'compliance_entity', status: 'active',
    definition: 'An immutable log entry recording who did what, when, to which object.',
    required_fields: ['actor_user_id', 'action', 'object_type', 'object_id', 'metadata'],
    relationships: ['Every execution/approval/document change emits events'],
    example: null,
  },
];

const entityTypeColors: Record<string, string> = {
  core_entity: 'bg-accent/10 text-accent border-accent/20',
  workflow_entity: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  compliance_entity: 'bg-red-500/10 text-red-600 border-red-500/20',
  computed_entity: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
};

const entityTypeLabels: Record<string, string> = {
  core_entity: 'Core',
  workflow_entity: 'Workflow',
  compliance_entity: 'Compliance',
  computed_entity: 'Computed',
};

export const OntologyCover: React.FC = () => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<typeof ONTOLOGY_TERMS[0] | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const filtered = ONTOLOGY_TERMS.filter((t) => {
    const matchesSearch = !search || t.term_key.includes(search.toLowerCase()) || t.display_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = !filterType || t.entity_type === filterType;
    return matchesSearch && matchesType;
  });

  const copyDefinition = (term: typeof ONTOLOGY_TERMS[0]) => {
    navigator.clipboard.writeText(`${term.display_name}: ${term.definition}`);
    toast({ title: 'Copied', description: `Definition for "${term.display_name}" copied to clipboard.` });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--pivt-gradient-primary)' }}>
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Ontology Dictionary</h1>
            <p className="text-sm text-muted-foreground">Single source of truth for every object in PIVT — v0</p>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="flex gap-1.5">
          {Object.entries(entityTypeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(filterType === key ? null : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filterType === key ? entityTypeColors[key] : 'border-border/50 text-muted-foreground hover:bg-muted/40'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Terms Table */}
      <div className="pivt-card overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_140px_100px_80px] gap-4 px-5 py-3 border-b border-border/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          <span>Term</span>
          <span>Definition</span>
          <span>Type</span>
          <span>Status</span>
          <span></span>
        </div>
        <div className="divide-y divide-border/30">
          {filtered.map((term) => (
            <motion.button
              key={term.term_key}
              onClick={() => setSelected(term)}
              className="w-full grid grid-cols-[1fr_1fr_140px_100px_80px] gap-4 px-5 py-4 text-left hover:bg-muted/20 transition-colors items-center"
              whileHover={{ x: 2 }}
            >
              <div>
                <p className="text-sm font-semibold">{term.display_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{term.term_key}</p>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{term.definition}</p>
              <Badge variant="outline" className={`text-[11px] w-fit ${entityTypeColors[term.entity_type]}`}>
                {entityTypeLabels[term.entity_type]}
              </Badge>
              <Badge variant="outline" className={`text-[11px] w-fit ${term.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                {term.status}
              </Badge>
              <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
            </motion.button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">No terms match your search.</div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-50"
              onClick={() => setSelected(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={springConfig.standard}
              className="fixed top-0 right-0 h-full w-full max-w-lg z-50 border-l border-border bg-background shadow-2xl overflow-y-auto"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-bold">{selected.display_name}</h2>
                    <p className="font-mono text-sm text-muted-foreground mt-0.5">{selected.term_key}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-muted/40">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <Badge variant="outline" className={entityTypeColors[selected.entity_type]}>
                    {entityTypeLabels[selected.entity_type]}
                  </Badge>
                  <Badge variant="outline" className={selected.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                    {selected.status}
                  </Badge>
                </div>

                {/* Definition */}
                <div className="pivt-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Definition</h3>
                    <Button variant="ghost" size="sm" onClick={() => copyDefinition(selected)} className="text-xs gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </Button>
                  </div>
                  <p className="text-sm leading-relaxed">{selected.definition}</p>
                </div>

                {/* Required Fields */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Required Fields</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.required_fields.map((f) => (
                      <Badge key={f} variant="outline" className="text-xs font-mono">{f}</Badge>
                    ))}
                  </div>
                </div>

                {/* Relationships */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Relationships</h3>
                  <div className="space-y-1.5">
                    {selected.relationships.map((r) => (
                      <div key={r} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <ArrowRight className="w-3.5 h-3.5 text-accent shrink-0" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Example */}
                {selected.example && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Example</h3>
                    <div className="pivt-card p-3 text-sm italic text-muted-foreground">
                      "{selected.example}"
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
