import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Validation = Tables<"validation_results">;

const icons = {
  validated: CheckCircle2,
  discrepancy: AlertTriangle,
  blocking: XCircle,
};

const colors = {
  validated: "text-validated bg-validated/10 border-validated/20",
  discrepancy: "text-discrepancy bg-discrepancy/10 border-discrepancy/20",
  blocking: "text-blocking bg-blocking/10 border-blocking/20",
};

const labels = {
  validated: "Validated",
  discrepancy: "Discrepancy Found",
  blocking: "Blocking Issue",
};

export default function ValidationTab({ dealId }: { dealId: string }) {
  const [results, setResults] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("validation_results")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at")
      .then(({ data }) => {
        setResults(data || []);
        setLoading(false);
      });
  }, [dealId]);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  if (results.length === 0) {
    return (
      <div className="pivt-card p-12 text-center">
        <p className="text-muted-foreground">No validation results yet. Run validation from the Waterfall tab.</p>
      </div>
    );
  }

  const allValid = results.every((r) => r.status === "validated");

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
        allValid ? "bg-validated/10 text-validated" : "bg-discrepancy/10 text-discrepancy"
      }`}>
        {allValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
        {allValid ? "All checks validated" : "Issues require attention"}
      </div>

      {results.map((r) => {
        const Icon = icons[r.status as keyof typeof icons] || CheckCircle2;
        const color = colors[r.status as keyof typeof colors] || colors.validated;
        const label = labels[r.status as keyof typeof labels] || "Pending";
        return (
          <div key={r.id} className={`pivt-card p-4 border-l-4 ${color}`}>
            <div className="flex items-center gap-3">
              <Icon className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{r.check_name}</p>
                <p className="text-sm opacity-80 mt-0.5">{r.message}</p>
                {r.affected_field && (
                  <p className="text-xs font-mono opacity-60 mt-1">Field: {r.affected_field}</p>
                )}
              </div>
              <span className="text-xs font-semibold uppercase">{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
