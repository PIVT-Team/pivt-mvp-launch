import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Send, ArrowLeft, Loader2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

const schema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  contactEmail: z.string().trim().email('Please enter a valid email').max(255),
  company: z.string().trim().min(1, 'Company is required').max(200),
  position: z.string().trim().min(1, 'Position is required').max(200),
  message: z.string().max(2000).optional(),
  _hp: z.string().max(0).optional(), // honeypot
});

type FormValues = z.infer<typeof schema>;

interface RequestAccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function RequestAccessModal({ open, onOpenChange, onSuccess }: RequestAccessModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', contactEmail: '', company: '', position: '', message: '', _hp: '' },
  });

  const handleSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { data, error } = await supabase.functions.invoke('request-access', {
        body: values,
      });

      if (error || !data?.success) {
        setSubmitError(data?.error || 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }

      setTicketId(data.ticketId);
      setSubmitting(false);
    } catch {
      setSubmitError('Something went wrong submitting your request. Please try again.');
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setTicketId(null);
      setSubmitError(null);
      form.reset();
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden border-border/50 bg-card">
        <DialogTitle className="sr-only">Request Access</DialogTitle>
        <AnimatePresence mode="wait">
          {ticketId ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center text-center p-8 sm:p-10"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-5"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </motion.div>
              <h2 className="text-xl font-semibold text-foreground mb-2">Request Submitted</h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-xs">
                Thank you for your interest in PIVT. Your request has been received and a confirmation email has been sent to your inbox.
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 border border-border mb-6">
                <span className="text-xs text-muted-foreground font-medium">Ticket ID</span>
                <span className="text-sm font-mono font-semibold text-foreground">{ticketId}</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" onClick={handleClose}>
                  <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Back to Demo
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Request Access</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">Tell us about yourself and we'll be in touch.</p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={form.handleSubmit(handleSubmit)} className="px-6 py-5 space-y-4">
                {/* Honeypot */}
                <input type="text" {...form.register('_hp')} className="hidden" tabIndex={-1} autoComplete="off" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-sm font-medium">Full Name <span className="text-destructive">*</span></Label>
                    <Input
                      id="fullName"
                      placeholder="Jane Smith"
                      {...form.register('fullName')}
                      className="h-10"
                    />
                    {form.formState.errors.fullName && (
                      <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="contactEmail" className="text-sm font-medium">Email <span className="text-destructive">*</span></Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      placeholder="jane@company.com"
                      {...form.register('contactEmail')}
                      className="h-10"
                    />
                    {form.formState.errors.contactEmail && (
                      <p className="text-xs text-destructive">{form.formState.errors.contactEmail.message}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="company" className="text-sm font-medium">Company <span className="text-destructive">*</span></Label>
                    <Input
                      id="company"
                      placeholder="Acme Corp"
                      {...form.register('company')}
                      className="h-10"
                    />
                    {form.formState.errors.company && (
                      <p className="text-xs text-destructive">{form.formState.errors.company.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="position" className="text-sm font-medium">Position <span className="text-destructive">*</span></Label>
                    <Input
                      id="position"
                      placeholder="VP of Operations"
                      {...form.register('position')}
                      className="h-10"
                    />
                    {form.formState.errors.position && (
                      <p className="text-xs text-destructive">{form.formState.errors.position.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Textarea
                    id="message"
                    placeholder="Tell us what you're looking for..."
                    rows={3}
                    {...form.register('message')}
                    className="resize-none"
                  />
                </div>

                {submitError && (
                  <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive">{submitError}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(262,72%,45%)] text-white hover:opacity-90 border-0"
                >
                  {submitting ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Submit Request</>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground/70">
                  We'll respond within 24–48 business hours.
                </p>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
