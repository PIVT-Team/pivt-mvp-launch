import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CookieBanner } from "@/components/CookieBanner";
import Dashboard from "@/pages/Dashboard";
import DealDetail from "@/pages/DealDetail";
import AppLayout from "@/components/AppLayout";
import NotFound from "./pages/NotFound";

const PIVTCompletePage = lazy(() =>
  import("./pages/PIVTCompletePage").catch(() => {
    return new Promise<typeof import("./pages/PIVTCompletePage")>(resolve => {
      setTimeout(() => resolve(import("./pages/PIVTCompletePage")), 1000);
    });
  })
);
const LoginPageLazy = lazy(() =>
  import("./pages/LoginPage").catch(() => {
    return new Promise<typeof import("./pages/LoginPage")>(resolve => {
      setTimeout(() => resolve(import("./pages/LoginPage")), 1000);
    });
  })
);
const VerifyPageLazy = lazy(() => import("./pages/VerifyPage"));
const CookiePolicyPageLazy = lazy(() => import("./pages/CookiePolicyPage"));
const PrivacyPolicyPageLazy = lazy(() => import("./pages/PrivacyPolicyPage"));
const TermsOfServicePageLazy = lazy(() => import("./pages/TermsOfServicePage"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPageLazy />} />
              <Route path="/verify" element={<VerifyPageLazy />} />
              <Route path="/cookie-policy" element={<CookiePolicyPageLazy />} />
              <Route path="/privacy" element={<PrivacyPolicyPageLazy />} />
              <Route path="/terms" element={<TermsOfServicePageLazy />} />
              <Route path="/" element={<AuthGuard><PIVTCompletePage /></AuthGuard>} />
              <Route path="/pivt" element={<Navigate to="/" replace />} />
              <Route path="/pivt/:section" element={<AuthGuard><PIVTCompletePage /></AuthGuard>} />
              <Route element={<AuthGuard><AppLayout /></AuthGuard>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/deals/:id" element={<DealDetail />} />
              </Route>
              <Route path="*" element={<AuthGuard><NotFound /></AuthGuard>} />
            </Routes>
          </Suspense>
          <CookieBanner />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;