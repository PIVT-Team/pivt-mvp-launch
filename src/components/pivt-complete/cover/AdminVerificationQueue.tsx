import React, { useEffect, useState } from 'react';
import { Shield, CheckCircle2, XCircle, Eye, Clock, MessageSquare } from 'lucide-react';
import { useKycStore, UserKyc, OrgKyb } from '@/stores/kycStore';

const AdminVerificationQueue: React.FC = () => {
  const { adminQueue, fetchAdminQueue, adminApproveKyc, adminRejectKyc, adminApproveKyb, adminRejectKyb } = useKycStore();
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { fetchAdminQueue(); }, []);

  const handleNote = (id: string, val: string) => setNoteInputs(prev => ({ ...prev, [id]: val }));

  const renderKycRow = (item: UserKyc) => (
    <div key={item.id} className="bg-[#2A2F3A] rounded-lg border border-white/5 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-accent" />
          <div>
            <p className="text-sm font-medium text-white">{item.full_legal_name || 'Unnamed'}</p>
            <p className="text-xs text-white/40">Individual KYC · Submitted {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--discrepancy))]/10 text-[hsl(var(--discrepancy))]">
            <Clock className="w-3 h-3 inline mr-1" />{item.status}
          </span>
          <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expandedId === item.id && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-white/40">Nationality:</span> <span className="text-white/70 ml-1">{item.nationality || '—'}</span></div>
            <div><span className="text-white/40">Role:</span> <span className="text-white/70 ml-1">{item.role_at_org || '—'}</span></div>
            <div><span className="text-white/40">Address:</span> <span className="text-white/70 ml-1">{item.residential_address || '—'}</span></div>
            <div><span className="text-white/40">DOB:</span> <span className="text-white/70 ml-1">{item.date_of_birth || '—'}</span></div>
          </div>
          {/* Banking Details */}
          {item.bank_name && (
            <div className="mt-2 p-3 bg-[#0F1220] rounded-lg border border-white/5">
              <p className="text-[10px] font-medium text-white/40 uppercase tracking-wider mb-2">Banking / Wire Details</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-white/40">Bank:</span> <span className="text-white/70 ml-1">{item.bank_name}</span></div>
                <div><span className="text-white/40">Account Holder:</span> <span className="text-white/70 ml-1">{item.account_holder_name || '—'}</span></div>
                <div><span className="text-white/40">Last 4:</span> <span className="text-white/70 ml-1 font-mono">••••{item.account_number_last4 || '—'}</span></div>
                <div><span className="text-white/40">Routing:</span> <span className="text-white/70 ml-1 font-mono">{item.routing_number || '—'}</span></div>
                <div><span className="text-white/40">SWIFT/BIC:</span> <span className="text-white/70 ml-1 font-mono">{item.swift_bic || '—'}</span></div>
                <div><span className="text-white/40">Currency:</span> <span className="text-white/70 ml-1">{item.wire_currency || 'USD'}</span></div>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-white/40">Admin Note</label>
            <textarea
              value={noteInputs[item.id] || ''}
              onChange={e => handleNote(item.id, e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0F1220] border border-white/10 rounded-lg text-xs text-white resize-none focus:outline-none focus:border-accent"
              rows={2}
              placeholder="Add a note..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => adminApproveKyc(item.id, noteInputs[item.id])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[hsl(var(--validated))]/10 text-[hsl(var(--validated))] hover:bg-[hsl(var(--validated))]/20 transition-all">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button onClick={() => adminRejectKyc(item.id, noteInputs[item.id])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[hsl(var(--blocking))]/10 text-[hsl(var(--blocking))] hover:bg-[hsl(var(--blocking))]/20 transition-all">
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderKybRow = (item: OrgKyb) => (
    <div key={item.id} className="bg-[#2A2F3A] rounded-lg border border-white/5 overflow-hidden">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-4 h-4 text-[#2F6BFF]" />
          <div>
            <p className="text-sm font-medium text-white">{item.legal_entity_name || 'Unnamed Org'}</p>
            <p className="text-xs text-white/40">Organization KYB · Submitted {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full bg-[hsl(var(--discrepancy))]/10 text-[hsl(var(--discrepancy))]">
            <Clock className="w-3 h-3 inline mr-1" />{item.status}
          </span>
          <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white transition-colors">
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expandedId === item.id && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-white/40">Jurisdiction:</span> <span className="text-white/70 ml-1">{item.country_jurisdiction || '—'}</span></div>
            <div><span className="text-white/40">Reg #:</span> <span className="text-white/70 ml-1">{item.registration_number || '—'}</span></div>
            <div><span className="text-white/40">Address:</span> <span className="text-white/70 ml-1">{item.registered_address || '—'}</span></div>
          </div>
          <div>
            <label className="text-xs text-white/40">Admin Note</label>
            <textarea
              value={noteInputs[item.id] || ''}
              onChange={e => handleNote(item.id, e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-[#0F1220] border border-white/10 rounded-lg text-xs text-white resize-none focus:outline-none focus:border-accent"
              rows={2}
              placeholder="Add a note..."
            />
          </div>
          <div className="flex gap-2">
            <button onClick={() => adminApproveKyb(item.id, noteInputs[item.id])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[hsl(var(--validated))]/10 text-[hsl(var(--validated))] hover:bg-[hsl(var(--validated))]/20 transition-all">
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </button>
            <button onClick={() => adminRejectKyb(item.id, noteInputs[item.id])} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[hsl(var(--blocking))]/10 text-[hsl(var(--blocking))] hover:bg-[hsl(var(--blocking))]/20 transition-all">
              <XCircle className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const totalPending = adminQueue.kyc.length + adminQueue.kyb.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Shield className="w-6 h-6 text-accent" /> Verification Queue
        </h1>
        <p className="text-sm text-white/40 mt-1">{totalPending} pending review{totalPending !== 1 ? 's' : ''}</p>
      </div>

      {totalPending === 0 ? (
        <div className="bg-[#2A2F3A] rounded-xl border border-white/5 p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-[hsl(var(--validated))] mx-auto mb-3" />
          <p className="text-white/60">No pending verifications</p>
        </div>
      ) : (
        <>
          {adminQueue.kyc.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Individual KYC</h3>
              {adminQueue.kyc.map(renderKycRow)}
            </div>
          )}
          {adminQueue.kyb.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Organization KYB</h3>
              {adminQueue.kyb.map(renderKybRow)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export { AdminVerificationQueue };
