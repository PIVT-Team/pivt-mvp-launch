import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Network } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import DealOverview from "@/components/deal/DealOverview";
import WaterfallTab from "@/components/deal/WaterfallTab";
import EscrowTab from "@/components/deal/EscrowTab";
import ValidationTab from "@/components/deal/ValidationTab";
import ApprovalsTab from "@/components/deal/ApprovalsTab";
import AuditLogTab from "@/components/deal/AuditLogTab";

type Deal = Tables<"deals">;

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDeal = async () => {
    if (!id) return;
    const { data } = await supabase.from("deals").select("*").eq("id", id).single();
    setDeal(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeal();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Deal not found</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-end mb-3">
        <Button asChild size="sm" variant="outline">
          <Link to={`/deals/${deal.id}/command-center`}>
            <Network className="w-3.5 h-3.5 mr-1.5" />
            Open Command Center
          </Link>
        </Button>
      </div>
      <DealOverview deal={deal} onUpdate={fetchDeal} />

      <Tabs defaultValue="waterfall" className="mt-8">
        <TabsList className="bg-muted">
          <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="escrow">Escrow</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="waterfall" className="mt-6">
          <WaterfallTab dealId={deal.id} dealValue={Number(deal.deal_value)} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="validation" className="mt-6">
          <ValidationTab dealId={deal.id} />
        </TabsContent>
        <TabsContent value="escrow" className="mt-6">
          <EscrowTab dealId={deal.id} isAdmin={isAdmin} />
        </TabsContent>
        <TabsContent value="approvals" className="mt-6">
          <ApprovalsTab dealId={deal.id} />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <AuditLogTab dealId={deal.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
