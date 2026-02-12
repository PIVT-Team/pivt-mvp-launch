import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Approval = Tables<"deal_approvals">;

export default function ApprovalsTab({ dealId }: { dealId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from("deal_approvals")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at");
    setApprovals(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [dealId]);

  const handleApproval = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("deal_approvals")
      .update({ status })
      .eq("id", id);
    if (!error) {
      await supabase.from("audit_log").insert({
        deal_id: dealId,
        user_id: user?.id,
        action: `${status === "approved" ? "Approved" : "Rejected"} payout`,
        details: { approval_id: id },
      });
      toast({ title: `Payout ${status}` });
      fetch();
    }
  };

  const buyerApprovals = approvals.filter((a) => a.approval_side === "buyer");
  const sellerApprovals = approvals.filter((a) => a.approval_side === "seller");
  const allBuyerApproved = buyerApprovals.length > 0 && buyerApprovals.every((a) => a.status === "approved");
  const allSellerApproved = sellerApprovals.length > 0 && sellerApprovals.every((a) => a.status === "approved");

  const icons = { pending: Clock, approved: CheckCircle2, rejected: XCircle };
  const colors = { pending: "text-muted-foreground", approved: "text-validated", rejected: "text-destructive" };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Dual approval status */}
      <div className="grid grid-cols-2 gap-4">
        <div className={`pivt-card p-5 text-center ${allBuyerApproved ? "border-validated/50" : ""}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Buyer Side</p>
          <div className="mt-2">
            {allBuyerApproved ? (
              <CheckCircle2 className="w-8 h-8 text-validated mx-auto" />
            ) : (
              <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
            )}
          </div>
          <p className="text-sm font-medium mt-2">{allBuyerApproved ? "Approved" : "Pending"}</p>
        </div>
        <div className={`pivt-card p-5 text-center ${allSellerApproved ? "border-validated/50" : ""}`}>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Seller Side</p>
          <div className="mt-2">
            {allSellerApproved ? (
              <CheckCircle2 className="w-8 h-8 text-validated mx-auto" />
            ) : (
              <Clock className="w-8 h-8 text-muted-foreground mx-auto" />
            )}
          </div>
          <p className="text-sm font-medium mt-2">{allSellerApproved ? "Approved" : "Pending"}</p>
        </div>
      </div>

      {allBuyerApproved && allSellerApproved && (
        <div className="bg-validated/10 text-validated px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Both sides approved. Payout execution is authorized.
        </div>
      )}

      {approvals.length === 0 ? (
        <div className="pivt-card p-12 text-center text-muted-foreground">
          No approvals configured for this deal yet.
        </div>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => {
            const Icon = icons[a.status as keyof typeof icons] || Clock;
            const color = colors[a.status as keyof typeof colors] || colors.pending;
            const isOwn = a.user_id === user?.id;
            return (
              <div key={a.id} className="pivt-card p-4 flex items-center gap-4">
                <Icon className={`w-5 h-5 ${color} shrink-0`} />
                <div className="flex-1">
                  <p className="font-medium capitalize">{a.approval_side} Side</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(a.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={a.status === "approved" ? "default" : a.status === "rejected" ? "destructive" : "secondary"}>
                  {a.status}
                </Badge>
                {isOwn && a.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleApproval(a.id, "approved")} className="bg-validated text-validated-foreground hover:bg-validated/90">
                      Approve
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleApproval(a.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
