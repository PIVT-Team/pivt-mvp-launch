import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateDealDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    deal_name: "",
    deal_value: "",
    closing_date: "",
    escrow_amount: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("deals").insert({
      deal_name: form.deal_name,
      deal_value: Number(form.deal_value),
      closing_date: form.closing_date || null,
      escrow_amount: Number(form.escrow_amount) || 0,
      created_by: user.id,
      status: "draft",
    });

    if (error) {
      toast({ title: "Error creating deal", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deal created" });
      setForm({ deal_name: "", deal_value: "", closing_date: "", escrow_amount: "" });
      onOpenChange(false);
      onCreated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Deal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Deal Name</Label>
            <Input
              value={form.deal_name}
              onChange={(e) => setForm({ ...form, deal_name: e.target.value })}
              placeholder="Project Atlas Acquisition"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Deal Value ($)</Label>
              <Input
                type="number"
                value={form.deal_value}
                onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                placeholder="50,000,000"
                required
                min={0}
              />
            </div>
            <div className="space-y-2">
              <Label>Escrow Amount ($)</Label>
              <Input
                type="number"
                value={form.escrow_amount}
                onChange={(e) => setForm({ ...form, escrow_amount: e.target.value })}
                placeholder="5,000,000"
                min={0}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Closing Date</Label>
            <Input
              type="date"
              value={form.closing_date}
              onChange={(e) => setForm({ ...form, closing_date: e.target.value })}
            />
          </div>
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? "Creating..." : "Create Deal"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
