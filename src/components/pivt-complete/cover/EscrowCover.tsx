import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { fadeInUp } from '@/lib/animations';
import {
  Lock, ArrowUpRight, Clock, TrendingUp, Info, Building2,
  Upload, Plus, FileText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface EscrowAccount {
  id: string;
  institution_name: string;
  account_type: string;
  masked_account_number: string | null;
  status: string;
  interest_rate: number;
  interest_split_client_percent: number;
  interest_split_platform_percent: number;
  opened_at: string | null;
}

interface EscrowTransaction {
  id: string;
  amount: number;
  description: string;
  status: string;
  created_at: string;
  executed_at: string | null;
}

const fmt = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const EscrowCover: React.FC = () => {
  const { dealId, realDeal } = useDealWorkspace();
  const [account, setAccount] = useState<EscrowAccount | null>(null);
  const [transactions, setTransactions] = useState<EscrowTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }

    Promise.all([
      supabase.from('escrow_accounts').select('*').eq('deal_id', dealId).maybeSingle(),
      supabase.from('escrow_transactions').select('*').eq('deal_id', dealId).order('created_at'),
    ]).then(([accRes, txRes]) => {
      setAccount(accRes.data || null);
      setTransactions(txRes.data || []);
      setLoading(false);
    });
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const escrowAmount = realDeal?.escrow_amount || 0;
  const hasAnyData = account || transactions.length > 0 || escrowAmount > 0;

  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        {/* Non-custody notice */}
        <div className="pivt-card p-3 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Info className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-[11px] text-muted-foreground">
            PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
          </p>
        </div>

        <div className="pivt-card border border-border/50 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No escrow structure configured yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Add escrow details or upload an escrow agreement to configure escrow tracking for this deal.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" className="gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Escrow Details
            </Button>
            <Button variant="outline" className="gap-2 text-sm">
              <Upload className="w-4 h-4" /> Upload Escrow Agreement
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Partial data: show what exists
  const totalTx = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const executed = transactions.filter(t => t.status === 'executed');
  const pending = transactions.filter(t => t.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Escrow & Funds Tracking</h2>
        {account && (
          <div className="flex items-center gap-3">
            <Badge className={account.status === 'active' || account.status === 'funded' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted/60 text-muted-foreground'}>
              {account.status.toUpperCase()}
            </Badge>
            {account.institution_name && (
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Building2 className="w-3 h-3" />
                {account.institution_name} • {account.account_type}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Non-custody notice */}
      <div className="pivt-card p-3 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Info className="w-4 h-4 text-blue-500" />
        </div>
        <p className="text-[11px] text-muted-foreground">
          PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Escrow Amount</p>
          <p className="text-xl font-bold font-mono">{escrowAmount > 0 ? fmt(escrowAmount) : '—'}</p>
          {escrowAmount > 0 && realDeal?.deal_value ? (
            <p className="text-xs text-muted-foreground mt-1">{((escrowAmount / realDeal.deal_value) * 100).toFixed(1)}% of deal value</p>
          ) : null}
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Account Details</p>
          <p className="text-sm font-medium">{account ? `${account.institution_name}` : 'Not configured'}</p>
          {account?.masked_account_number && <p className="text-xs text-muted-foreground mt-1">{account.masked_account_number}</p>}
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Transactions</p>
          <p className="text-xl font-bold font-mono">{transactions.length > 0 ? fmt(totalTx) : '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{transactions.length} transaction{transactions.length !== 1 ? 's' : ''}</p>
        </motion.div>
        <motion.div {...fadeInUp} className="pivt-card p-6">
          <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Funding Status</p>
          <p className="text-sm font-medium">{account?.opened_at ? 'Opened' : 'Not started'}</p>
        </motion.div>
      </div>

      {/* Transactions list */}
      {transactions.length > 0 ? (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-medium">Escrow Transactions</h3>
          </div>
          <div className="divide-y divide-border">
            {transactions.map(t => (
              <div key={t.id} className="px-4 py-3 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{t.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date(t.created_at).toLocaleDateString()}
                    {t.executed_at && ` • Executed ${new Date(t.executed_at).toLocaleDateString()}`}
                  </p>
                </div>
                <p className="font-mono font-semibold text-sm">{fmtCurrency(Number(t.amount))}</p>
                <Badge variant="outline" className="text-[10px]">{t.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pivt-card p-8 text-center text-muted-foreground">
          <p className="text-sm">No escrow transactions recorded yet.</p>
        </div>
      )}
    </div>
  );
};
