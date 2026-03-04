import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
  "Private Company Share Purchase", "Private Equity Acquisition", "Asset Acquisition", "Merger",
  "Leveraged Buyout", "Growth Equity", "Venture Investment", "Secondary Transaction", "Other",
];

const CURRENCY_GROUPS = [
  {
    label: "Major",
    currencies: [
      { code: "USD", name: "US Dollar", region: "United States" },
      { code: "EUR", name: "Euro", region: "European Union" },
      { code: "GBP", name: "British Pound", region: "United Kingdom" },
    ],
  },
  {
    label: "Asia-Pacific",
    currencies: [
      { code: "JPY", name: "Japanese Yen", region: "Japan" },
      { code: "CNY", name: "Chinese Yuan", region: "China" },
      { code: "SGD", name: "Singapore Dollar", region: "Singapore" },
      { code: "HKD", name: "Hong Kong Dollar", region: "Hong Kong" },
      { code: "KRW", name: "South Korean Won", region: "South Korea" },
      { code: "INR", name: "Indian Rupee", region: "India" },
      { code: "AUD", name: "Australian Dollar", region: "Australia" },
    ],
  },
  {
    label: "Americas",
    currencies: [
      { code: "CAD", name: "Canadian Dollar", region: "Canada" },
      { code: "BRL", name: "Brazilian Real", region: "Brazil" },
      { code: "MXN", name: "Mexican Peso", region: "Mexico" },
    ],
  },
  {
    label: "Europe",
    currencies: [
      { code: "CHF", name: "Swiss Franc", region: "Switzerland" },
      { code: "SEK", name: "Swedish Krona", region: "Sweden" },
      { code: "NOK", name: "Norwegian Krone", region: "Norway" },
      { code: "DKK", name: "Danish Krone", region: "Denmark" },
      { code: "PLN", name: "Polish Zloty", region: "Poland" },
    ],
  },
  {
    label: "Middle East & Africa",
    currencies: [
      { code: "AED", name: "UAE Dirham", region: "United Arab Emirates" },
      { code: "ZAR", name: "South African Rand", region: "South Africa" },
    ],
  },
];

const ALL_CURRENCIES = CURRENCY_GROUPS.flatMap((g) => g.currencies);

export default function CreateDealDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [signingDate, setSigningDate] = useState<Date>();
  const [closingDate, setClosingDate] = useState<Date>();
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(["USD"]);
  const [form, setForm] = useState({
    deal_name: "",
    deal_type: "",
    sector: "",
    buyer: "",
    seller: "",
    target_company: "",
    deal_value: "",
    escrow_amount: "",
    jurisdiction: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCurrency = (code: string) => {
    setSelectedCurrencies((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

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
      currency: selectedCurrencies[0] || "USD",
      jurisdiction: form.jurisdiction || null,
      signing_date: signingDate ? format(signingDate, "yyyy-MM-dd") : null,
      closing_date: closingDate ? format(closingDate, "yyyy-MM-dd") : null,
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
        target_company: "", deal_value: "", escrow_amount: "",
        jurisdiction: "",
      });
      setSigningDate(undefined);
      setClosingDate(undefined);
      setSelectedCurrencies(["USD"]);
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Deal Value</Label>
                <Input type="number" value={form.deal_value} onChange={(e) => set("deal_value", e.target.value)} placeholder="12,500,000" required min={0} />
              </div>
              <div className="space-y-1.5">
                <Label>Escrow Amount</Label>
                <Input type="number" value={form.escrow_amount} onChange={(e) => set("escrow_amount", e.target.value)} placeholder="200,000" min={0} />
              </div>
            </div>
            <div className="space-y-1.5 mt-3">
              <Label>Currencies</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedCurrencies.map((code) => {
                  const c = ALL_CURRENCIES.find((x) => x.code === code);
                  return (
                    <Badge key={code} variant="secondary" className="gap-1 pr-1">
                      {code}
                      {selectedCurrencies.length > 1 && (
                        <button type="button" onClick={() => toggleCurrency(code)} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
              <Select onValueChange={(v) => { if (!selectedCurrencies.includes(v)) toggleCurrency(v); }}>
                <SelectTrigger><SelectValue placeholder="Add currency…" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {CURRENCY_GROUPS.map((group) => (
                    <SelectGroup key={group.label}>
                      <SelectLabel>{group.label}</SelectLabel>
                      {group.currencies.map((c) => (
                        <SelectItem key={c.code} value={c.code} disabled={selectedCurrencies.includes(c.code)}>
                          {c.code} — {c.name} ({c.region})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Jurisdiction & Timing */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jurisdiction & Timing</p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Jurisdiction</Label>
                <Input value={form.jurisdiction} onChange={(e) => set("jurisdiction", e.target.value)} placeholder="Delaware, United States" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Signing Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !signingDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {signingDate ? format(signingDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={signingDate} onSelect={setSigningDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Close Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !closingDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {closingDate ? format(closingDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={closingDate} onSelect={setClosingDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
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
