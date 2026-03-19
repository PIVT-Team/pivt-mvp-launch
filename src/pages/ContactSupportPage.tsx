import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Headphones, Scale, ShieldCheck, Lock, Newspaper, Handshake, Mail, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const contacts = [
  { label: 'Support', email: 'support@pivttech.ai', desc: 'General & technical help', icon: Headphones },
  { label: 'Legal', email: 'legal@pivttech.ai', desc: 'Terms, disputes & notices', icon: Scale },
  { label: 'Privacy', email: 'privacy@pivttech.ai', desc: 'Data rights & privacy', icon: ShieldCheck },
  { label: 'Security', email: 'security@pivttech.ai', desc: 'Vulnerability reporting', icon: Lock },
  { label: 'Press', email: 'press@pivttech.ai', desc: 'Media & speaking', icon: Newspaper },
  { label: 'Partnerships', email: 'partnerships@pivttech.ai', desc: 'Business development', icon: Handshake },
];

const policySections = [
  { title: '1. Overview', content: 'PIVT, Inc. is committed to providing responsive, reliable, and professional support for all users of the PIVT platform. If you have any questions, concerns, or requests, please contact us using the appropriate channel below.' },
  { title: '2. General Support', content: 'For general inquiries, technical support, or assistance with the platform:\n\nEmail: support@pivttech.ai\n\nWe aim to respond within 24–48 hours on business days.' },
  { title: '3. Legal Inquiries', content: 'For legal matters, including Terms of Service, disputes, or formal notices:\n\nEmail: legal@pivttech.ai' },
  { title: '4. Privacy & Data Requests', content: 'For questions regarding privacy, personal data, or to exercise your data rights:\n\nEmail: privacy@pivttech.ai' },
  { title: '5. Security & Vulnerability Reporting', content: 'If you believe you have identified a security vulnerability or issue, please report it immediately:\n\nEmail: security@pivttech.ai\n\nWe take all security reports seriously and will investigate promptly.' },
  { title: '6. Press & Media', content: 'For press inquiries, media requests, or speaking opportunities:\n\nEmail: press@pivttech.ai' },
  { title: '7. Partnerships & Business Development', content: 'For partnership opportunities, integrations, or business development:\n\nEmail: partnerships@pivttech.ai' },
  { title: '8. Mailing Address', content: 'PIVT, Inc.\nSan Francisco, California, United States' },
  { title: '9. Response Expectations', content: 'PIVT aims to respond to all inquiries in a timely manner. Response times may vary depending on the nature and complexity of the request.' },
  { title: '10. Updates', content: 'We may update this Contact & Support information periodically. Please refer to the "Last Updated" date for the most current version.' },
];

const ContactSupportPage: React.FC = () => {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [honeypot, setHoneypot] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-form', {
        body: { name: form.name, email: form.email, message: form.message, _hp: honeypot },
      });
      if (error) throw error;
      if (data && !data.success) {
        toast({ title: 'Error', description: data.error || 'Your message could not be sent. Please try again or email support@pivttech.ai directly.', variant: 'destructive' });
      } else {
        setForm({ name: '', email: '', message: '' });
        toast({ title: 'Message sent', description: "Your message has been sent. We'll respond within 24–48 business hours." });
      }
    } catch {
      toast({ title: 'Error', description: 'Your message could not be sent. Please try again or email support@pivttech.ai directly.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to PIVT
        </Link>

        {/* Header */}
        <div className="flex items-start gap-4 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--pivt-gradient-primary)' }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Contact & Support</h1>
            <p className="text-sm text-muted-foreground mt-0.5">PIVT, Inc. · Last updated: March 19, 2026</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-8 ml-14">We're here to help. Reach out to the appropriate team below.</p>

        {/* Contact cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-12">
          {contacts.map((c) => (
            <a
              key={c.email}
              href={`mailto:${c.email}`}
              className="flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors group"
            >
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50 group-hover:bg-accent/10 transition-colors">
                <c.icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{c.label}</p>
                <p className="text-xs text-muted-foreground truncate">{c.email}</p>
              </div>
            </a>
          ))}
        </div>

        {/* Contact form */}
        <div className="mb-12 p-6 rounded-xl border border-border bg-card">
          <h2 className="text-lg font-semibold text-foreground mb-1">Send us a message</h2>
          <p className="text-xs text-muted-foreground mb-5">We'll respond within 24–48 business hours.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
                required
              />
              <Input
                type="email"
                placeholder="Your email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                maxLength={255}
                required
              />
            </div>
            {/* Honeypot - hidden from real users */}
            <input
              type="text"
              name="_hp"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="absolute opacity-0 h-0 w-0 pointer-events-none"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />
            <Textarea
              placeholder="How can we help?"
              value={form.message}
              onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
              maxLength={5000}
              rows={4}
              required
            />
            <Button type="submit" disabled={sending} className="gap-2">
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sending…' : 'Send Message'}
            </Button>
          </form>
        </div>

        {/* Full policy sections */}
        <div className="space-y-8">
          {policySections.map((s) => (
            <section key={s.title}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{s.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{s.content}</p>
            </section>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-border flex items-center gap-4 text-xs text-muted-foreground/60">
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <span>·</span>
          <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
        </div>
      </div>
    </div>
  );
};

export default ContactSupportPage;
