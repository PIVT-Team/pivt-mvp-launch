import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, AlertCircle, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackAuthEvent } from '@/services/authTrackingService';
import pivtLogo from '@/assets/pivt-logo.png';

const LoginPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/?section=deals" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isLogin) {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        trackAuthEvent({ eventType: 'failed_login_attempt', email, metadata: { reason: err.message } });
      } else {
        toast.success('Welcome back');
        trackAuthEvent({ eventType: 'user_login', userId: data.user?.id, email, loginMethod: 'password' });
      }
    } else {
      if (!fullName.trim()) { setError('Full name is required.'); setLoading(false); return; }
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: window.location.origin,
        },
      });
      if (err) {
        setError(err.message);
        trackAuthEvent({ eventType: 'failed_login_attempt', email, metadata: { reason: err.message, action: 'signup' } });
      } else {
        toast.success('Account created — you are now signed in.');
        trackAuthEvent({ eventType: 'account_created', userId: data.user?.id, email, loginMethod: 'password' });
        trackAuthEvent({ eventType: 'user_login', userId: data.user?.id, email, loginMethod: 'password', metadata: { first_login: true } });
      }
    }
    setLoading(false);
  };


  return (
    <div className="min-h-screen flex items-center justify-center pivt-ambient-bg px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <img src={pivtLogo} alt="PIVT" className="h-16 w-auto" />
        </div>

        <div className="pivt-card p-6 space-y-5">
          {/* Toggle sign-in / sign-up */}
          <div className="flex gap-2">
            <button
              onClick={() => { setIsLogin(true); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                isLogin ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setIsLogin(false); setError(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                !isLogin ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg text-sm font-medium"
              style={{
                background: 'hsl(0 60% 50% / 0.08)',
                color: 'hsl(0 60% 50%)',
                border: '1px solid hsl(0 60% 50% / 0.15)',
              }}
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Jane Smith"
                  className="h-10"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@firm.com"
                className="h-10"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder="••••••••"
                className="h-10"
                required
                minLength={6}
              />
            </div>

          <Button type="submit" className="w-full h-10 pivt-btn-primary" disabled={loading}>
              {isLogin ? <LogIn className="w-4 h-4 mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;