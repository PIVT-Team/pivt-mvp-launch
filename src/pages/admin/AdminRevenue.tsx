import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Users, TrendingUp, BarChart3 } from "lucide-react";

export default function AdminRevenue() {
  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revenue & Commercial Metrics</h1>
        <p className="text-sm text-muted-foreground mt-1">Account, revenue, and adoption tracking</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Paid Accounts", value: "—", icon: DollarSign },
          { label: "Trial Accounts", value: "—", icon: Users },
          { label: "Est. Transaction Volume", value: "—", icon: TrendingUp },
          { label: "Feature Adoption", value: "—", icon: BarChart3 },
        ].map(m => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-muted-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Insufficient Data</CardTitle>
          <CardDescription>
            Revenue and commercial metrics will populate once billing integration and account classification are configured.
            This section is future-ready for tracking paid accounts, trial accounts, enterprise pipeline, deal volume by customer,
            and projected revenue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-12 text-center text-muted-foreground">
            <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Commercial metrics will appear here once billing data is available.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
