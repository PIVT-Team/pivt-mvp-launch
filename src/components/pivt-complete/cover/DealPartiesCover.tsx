import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { fadeInUp } from '@/lib/animations';
import { Building2, Plus, Users, Shield, Scale } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface DealParty {
  id: string;
  party_type: string;
  organization: { id: string; name: string } | null;
}

const PARTY_SIDE: Record<string, string> = {
  buyer: 'Buyer-side',
  seller: 'Seller-side',
  target: 'Target',
  escrow_agent: 'Neutral',
  lender: 'Buyer-side',
  buyer_counsel: 'Buyer-side',
  seller_counsel: 'Seller-side',
  paying_agent: 'Neutral',
};

const PARTY_LABEL: Record<string, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  target: 'Target',
  escrow_agent: 'Escrow Agent',
  lender: 'Lender',
  buyer_counsel: 'Buyer Counsel',
  seller_counsel: 'Seller Counsel',
  paying_agent: 'Paying Agent',
};

export const DealPartiesCover: React.FC = () => {
  const { dealId, isDemoDeal, realDeal } = useDealWorkspace();
  const [parties, setParties] = useState<DealParty[]>([]);
  const [capTableParties, setCapTableParties] = useState<{ id: string; shareholder_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }

    const fetchParties = async () => {
      setLoading(true);
      const [dpResult, ctResult] = await Promise.all([
        supabase
          .from('deal_parties')
          .select('id, party_type, organization:organizations(id, name)')
          .eq('deal_id', dealId),
        // Also fetch cap_table_entries with deal-party roles (Buyer, Seller, Target, etc.)
        supabase
          .from('cap_table_entries')
          .select('id, shareholder_name, role')
          .eq('deal_id', dealId)
          .in('role', ['Buyer', 'Seller', 'Target', 'Merger Sub', 'Escrow Agent', 'Lender', 'Buyer Counsel', 'Seller Counsel', 'Paying Agent', 'Administrative Agent']),
      ]);
      setParties((dpResult.data as any[]) || []);
      setCapTableParties(ctResult.data || []);
      setLoading(false);
    };
    fetchParties();
  }, [dealId]);

  // Derive party-like info from deal record itself
  const inferredParties: { name: string; type: string; side: string }[] = [];
  if (realDeal) {
    if (realDeal.buyer) inferredParties.push({ name: realDeal.buyer, type: 'Buyer', side: 'Buyer-side' });
    if (realDeal.seller) inferredParties.push({ name: realDeal.seller, type: 'Seller', side: 'Seller-side' });
    if (realDeal.target_company) inferredParties.push({ name: realDeal.target_company, type: 'Target', side: 'Target' });
  }

  // For demo deals, also infer from pivtStore deal data
  if (isDemoDeal && !realDeal) {
    // These come from the pivtStore demo deal
    const demoDealData = {
      atlas: { buyer: 'Apex Capital Partners', seller: 'Northbridge Software', target: 'Northbridge Software' },
      beacon: { buyer: 'Meridian Holdings', seller: 'CloudVault Security', target: 'CloudVault Security' },
      cipher: { buyer: 'Titan Strategic Group', seller: 'NeuralPath AI', target: 'NeuralPath AI' },
    };
    const key = dealId as string;
    const demoData = demoDealData[key as keyof typeof demoDealData];
    if (demoData) {
      inferredParties.push({ name: demoData.buyer, type: 'Buyer', side: 'Buyer-side' });
      inferredParties.push({ name: demoData.seller, type: 'Seller', side: 'Seller-side' });
      if (demoData.target !== demoData.seller) {
        inferredParties.push({ name: demoData.target, type: 'Target', side: 'Target' });
      }
    }
  }

  const allParties = [
    ...inferredParties.map((p, i) => ({ id: `inferred-${i}`, name: p.name, type: p.type, side: p.side, source: 'deal' as const })),
    ...parties.map(p => ({
      id: p.id,
      name: p.organization?.name || 'Unknown',
      type: PARTY_LABEL[p.party_type] || p.party_type,
      side: PARTY_SIDE[p.party_type] || 'Neutral',
      source: 'parties_table' as const,
    })),
    // Include cap_table_entries with deal-party roles
    ...capTableParties.map(p => ({
      id: p.id,
      name: p.shareholder_name,
      type: PARTY_LABEL[p.role.toLowerCase().replace(/ /g, '_')] || p.role,
      side: PARTY_SIDE[p.role.toLowerCase().replace(/ /g, '_')] || 'Neutral',
      source: 'parties_table' as const,
    })),
  ];

  // Deduplicate by name+type
  const seen = new Set<string>();
  const uniqueParties = allParties.filter(p => {
    const key = `${p.name}::${p.type}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const buyerSide = uniqueParties.filter(p => p.side === 'Buyer-side').length;
  const sellerSide = uniqueParties.filter(p => p.side === 'Seller-side').length;
  const neutral = uniqueParties.filter(p => p.side !== 'Buyer-side' && p.side !== 'Seller-side').length;

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Deal Parties</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Legal and transactional entities involved in this deal.</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Parties', value: uniqueParties.length, icon: Building2, color: 'text-accent' },
          { label: 'Buyer-side', value: buyerSide, icon: Users, color: 'text-blue-500' },
          { label: 'Seller-side', value: sellerSide, icon: Users, color: 'text-emerald-500' },
          { label: 'Neutral', value: neutral, icon: Scale, color: 'text-muted-foreground' },
        ].map(card => (
          <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-lg font-semibold">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {uniqueParties.length === 0 ? (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">No deal parties defined yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add buyer, seller, target, and other transactional entities to define the deal structure.
            </p>
          </div>
        </motion.div>
      ) : (
        <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Party Name</span>
              <span>Party Type</span>
              <span>Side</span>
              <span className="text-center">Source</span>
            </div>
          </div>
          {uniqueParties.map(p => (
            <div key={p.id} className="p-4 border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
              <div className="grid grid-cols-5 items-center">
                <div className="col-span-2">
                  <p className="font-medium">{p.name}</p>
                </div>
                <span className="text-sm text-muted-foreground">{p.type}</span>
                <Badge variant="outline" className="text-[10px] w-fit">
                  {p.side}
                </Badge>
                <div className="text-center">
                  <Badge variant="secondary" className="text-[9px]">
                    {p.source === 'deal' ? 'Deal Record' : 'Parties Table'}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
