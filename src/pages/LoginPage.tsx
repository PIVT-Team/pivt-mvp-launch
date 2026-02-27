import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, LogIn, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useDemoAuth } from '@/contexts/DemoAuthContext';
import { toast } from 'sonner';
import pivtLogo from '@/assets/pivt-logo.png';

const LoginPage: React.FC = () => {
  const { isAuthenticated, login } = useDemoAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  if (isAuthenticated) return <Navigate to="/" replace />;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldError('');

    if (!username.trim() || !password.trim()) {
      setFieldError('Please enter username and password.');
      return;
    }

    const result = login(username.trim(), password);
    if (result.success) {
      toast.success('Welcome');
      navigate('/', { replace: true });
    } else {
      setError(result.error || 'Login failed.');
    }
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
          <img src={pivtLogo} alt="PIVT" className="h-16 w-auto mb-3" />
          <h1 className="text-xl font-semibold text-foreground" style={{ letterSpacing: '-0.03em' }}>
            PIVT Demo Access
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to continue</p>
        </div>

        <div className="pivt-card p-6 space-y-5">
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
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-sm font-medium">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoFocus
                value={username}
                onChange={(e) => { setUsername(e.target.value); setFieldError(''); }}
                placeholder="Enter username"
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
                placeholder="Enter password"
                className="h-10"
              />
            </div>

            {fieldError && (
              <p className="text-xs text-destructive">{fieldError}</p>
            )}

            <Button type="submit" className="w-full h-10 pivt-btn-primary">
              <LogIn className="w-4 h-4 mr-2" />
              Log in
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground/60 text-center">For demo access only.</p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
