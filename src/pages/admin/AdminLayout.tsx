import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Inbox, BarChart3, TrendingUp, AlertTriangle,
  ScrollText, Bot, Shield, LogOut, ChevronLeft, DollarSign, KeyRound
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { path: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { path: "/admin/support", label: "Support Inbox", icon: Inbox },
  { path: "/admin/auth", label: "User & Auth", icon: KeyRound },
  { path: "/admin/analytics", label: "Platform Analytics", icon: BarChart3 },
  { path: "/admin/deal-funnel", label: "Deal Funnel", icon: TrendingUp },
  { path: "/admin/newton", label: "Newton / AI", icon: Bot },
  { path: "/admin/risk", label: "Risk Monitor", icon: AlertTriangle },
  { path: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { path: "/admin/audit", label: "Audit Log", icon: ScrollText },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  ops_admin: "Ops Admin",
  support_admin: "Support Admin",
  read_only: "Read Only",
};

export default function AdminLayout() {
  const { user, loading, isPlatformAdmin, isApprovedAdmin, adminRole, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isPlatformAdmin || !isApprovedAdmin) {
    const AccessDenied = lazy(() => import("./AccessDenied"));
    return <Suspense fallback={null}><AccessDenied /></Suspense>;
  }

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-background border-r border-border flex flex-col shrink-0">
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-lg font-bold text-foreground tracking-tight">PIVT</span>
              <span className="text-xs text-muted-foreground ml-1.5">Admin</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.path
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border space-y-2">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Platform
          </Link>
          <div className="flex items-center gap-2 px-3 py-1">
            <span className="truncate flex-1 text-xs text-muted-foreground">{user.email}</span>
            {adminRole && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {ROLE_LABELS[adminRole] ?? adminRole}
              </Badge>
            )}
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
