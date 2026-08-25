import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  // Track agreement to the Terms / Privacy / DPA at signup time. Stored
  // in the new user's auth metadata on signup so we have a record of what
  // they agreed to and when, in case anyone asks later.
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block signup until the user has explicitly agreed. Login skips this
    // because returning users already agreed when they signed up.
    if (!isLogin && !agreedToTerms) {
      toast({
        title: "Please accept the Terms",
        description: "You must agree to the Terms of Service, Privacy Policy, and DPA to create an account.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Authentication failed", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            // Audit trail: who agreed, to what, when. Lives on auth.users
            // raw_user_meta_data so it's queryable in support cases.
            terms_accepted: true,
            terms_accepted_at: new Date().toISOString(),
            terms_version: "2026-05-18",
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Check your email", description: "We sent you a confirmation link." });
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-accent-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PIVT</h1>
        </div>
        <p className="text-center text-muted-foreground text-sm mb-8">
          The payments execution layer for M&A
        </p>

        <div className="pivt-card p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@firm.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            {/* Agreement checkbox — required to enable Create Account.
                Links open in new tabs so the user doesn't lose their
                signup form state. */}
            {!isLogin && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-accent shrink-0 cursor-pointer"
                  required
                />
                <span>
                  I agree to PIVT's{' '}
                  <Link to="/terms" target="_blank" className="text-accent hover:underline">Terms of Service</Link>,{' '}
                  <Link to="/privacy" target="_blank" className="text-accent hover:underline">Privacy Policy</Link>, and{' '}
                  <Link to="/dpa" target="_blank" className="text-accent hover:underline">Data Processing Agreement</Link>.
                </span>
              </label>
            )}
            <Button
              type="submit"
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={loading || (!isLogin && !agreedToTerms)}
            >
              {loading ? "Processing..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Secure. Auditable. Institutional-grade.
        </p>
        {/* Always-visible legal footer so even sign-in users can find the
            documents without a separate marketing site. */}
        <p className="text-center text-[11px] text-muted-foreground/70 mt-3">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <span className="mx-1.5">·</span>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <span className="mx-1.5">·</span>
          <Link to="/dpa" className="hover:text-foreground transition-colors">DPA</Link>
          <span className="mx-1.5">·</span>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookies</Link>
        </p>
      </div>
    </div>
  );
}
