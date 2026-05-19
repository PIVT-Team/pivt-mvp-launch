import { useLocation, Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Home, LifeBuoy, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Keep the console log — useful for spotting genuinely-broken links the
    // app shouldn't be generating (vs. typos in the URL bar).
    console.warn("404: route not found", { path: location.pathname });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex items-center justify-center pivt-ambient-bg px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-md text-center"
      >
        <div className="pivt-card p-10 space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">404</p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">We couldn't find that page</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The link you followed may be broken, or the page may have moved.
              The address we tried was:
            </p>
            <code className="mt-3 inline-block max-w-full break-all rounded-md bg-muted/60 px-2.5 py-1 text-xs font-mono text-muted-foreground">
              {location.pathname || '/'}
            </code>
          </div>

          <div className="flex flex-col gap-2">
            <Button asChild className="w-full pivt-btn-primary">
              <Link to="/" className="flex items-center justify-center gap-2">
                <Home className="w-4 h-4" /> Back to home
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-1.5" /> Go back
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/contact" className="flex items-center justify-center gap-1.5">
                  <LifeBuoy className="w-4 h-4" /> Contact support
                </Link>
              </Button>
            </div>
          </div>

          <div className="pt-4 border-t border-border/40 text-left">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-2 flex items-center gap-1.5">
              <Search className="w-3 h-3" /> Common destinations
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <Link to="/?section=deals" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1">Deals</Link>
              <Link to="/?section=portfolio-payments" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1">Payments</Link>
              <Link to="/?section=reports" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1">Reports</Link>
              <Link to="/?section=audit-log" className="text-xs text-muted-foreground hover:text-foreground transition-colors py-1">Audit Log</Link>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-muted-foreground/70 mt-4">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span className="mx-1.5">·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span className="mx-1.5">·</span>
          <Link to="/dpa" className="hover:text-foreground transition-colors">DPA</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default NotFound;
