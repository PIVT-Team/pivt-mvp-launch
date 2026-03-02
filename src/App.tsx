import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { DemoAuthProvider, useDemoAuth } from "@/contexts/DemoAuthContext";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import DealDetail from "@/pages/DealDetail";
import AppLayout from "@/components/AppLayout";
import NotFound from "./pages/NotFound";

const PIVTCompletePage = lazy(() =>
  import("./pages/PIVTCompletePage").catch(() => {
    // Retry once on dynamic import failure (stale HMR cache)
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


const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

const DemoGuard = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useDemoAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DemoAuthProvider>
        <AuthProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/login" element={<LoginPageLazy />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/" element={<DemoGuard><PIVTCompletePage /></DemoGuard>} />
                <Route path="/pivt" element={<Navigate to="/" replace />} />
                <Route path="/pivt/:section" element={<DemoGuard><PIVTCompletePage /></DemoGuard>} />
                <Route element={<DemoGuard><AppLayout /></DemoGuard>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/deals/:id" element={<DealDetail />} />
                </Route>
                <Route path="*" element={<DemoGuard><NotFound /></DemoGuard>} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </DemoAuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
