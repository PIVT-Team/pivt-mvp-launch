import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const SECTORS = [
  "Technology", "Healthcare", "Financial Services", "Energy", "Real Estate",
  "Consumer", "Industrials", "Media & Entertainment", "Telecommunications", "Other",
];

const DEAL_TYPES = [
  "Private Company Share Purchase", "Asset Acquisition", "Merger",
  "Leveraged Buyout", "Growth Equity", "Venture Investment", "Other",
];

const CURRENCIES = ["USD", "EUR", "GBP"];

export default function CreateDealDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    deal_name: "",
    deal_type: "",
    sector: "",
    buyer: "",
    seller: "",
    target_company: "",
    deal_value: "",
    escrow_amount: "",
    currency: "USD",
    jurisdiction: "",
    closing_date: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("deals").insert({
      deal_name: form.deal_name,
      deal_type: form.deal_type || null,
      sector: form.sector || null,
      buyer: form.buyer || null,
      seller: form.seller || null,
      target_company: form.target_company || null,
      deal_value: Number(form.deal_value),
      escrow_amount: Number(form.escrow_amount) || 0,
      currency: form.currency,
      jurisdiction: form.jurisdiction || null,
      closing_date: form.closing_date || null,
      created_by: user.id,
      owner_id: user.id,
      status: "draft",
      deal_number: "",
      deal_kind: "live" as any,
      visibility: "private",
      is_demo: false,
    } as any);

    if (error) {
      toast({ title: "Error creating deal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal created" });
      setForm({
        deal_name: "", deal_type: "", sector: "", buyer: "", seller: "",
        target_company: "", deal_value: "", escrow_amount: "", currency: "USD",
        jurisdiction: "", closing_date: "",
      });
      onOpenChange(false);
      onCreated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Transaction Overview */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Transaction Overview</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Deal Name</Label>
                <Input value={form.deal_name} onChange={(e) => set("deal_name", e.target.value)} placeholder="Project Nimbus Acquisition" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Deal Type</Label>
                  <Select value={form.deal_type} onValueChange={(v) => set("deal_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {DEAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Sector</Label>
                  <Select value={form.sector} onValueChange={(v) => set("sector", v)}>
                    <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                    <SelectContent>
                      {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Parties */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Parties</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Buyer</Label>
                <Input value={form.buyer} onChange={(e) => set("buyer", e.target.value)} placeholder="Orion Data Systems LLC" />
              </div>
              <div className="space-y-1.5">
                <Label>Seller</Label>
                <Input value={form.seller} onChange={(e) => set("seller", e.target.value)} placeholder="Aurora Ventures Fund I, LP" />
              </div>
              <div className="space-y-1.5">
                <Label>Target Company</Label>
                <Input value={form.target_company} onChange={(e) => set("target_company", e.target.value)} placeholder="Nimbus Analytics Inc." />
              </div>
            </div>
          </div>

          <Separator />

          {/* Financial Terms */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Financial Terms</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Deal Value ($)</Label>
                <Input type="number" value={form.deal_value} onChange={(e) => set("deal_value", e.target.value)} placeholder="12,500,000" required min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>Escrow Amount ($)</Label>
                <Input type="number" value={form.escrow_amount} onChange={(e) => set("escrow_amount", e.target.value)} placeholder="200,000" min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Jurisdiction & Timing */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jurisdiction & Timing</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Jurisdiction</Label>
                <Input value={form.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} placeholder="Delaware, United States" />
              </div>
              <div className="space-y-1.5">
                <Label>Expected Close Date</Label>
                <Input type="date" value={form.closing_date} onChange={(e) => set("closing_date", e.target.value)} />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? "Creating..." : "Create Deal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
