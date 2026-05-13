/**
 * SupportPanel — 3-layer support: Q&A → Newton AI → Escalation
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { springConfig } from '@/lib/animations';
import {
  HelpCircle, X, Search, ChevronRight, ChevronLeft, Sparkles,
  Send, Loader2, ArrowUpRight, CheckCircle2, AlertTriangle,
  Upload, Paperclip,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { usePIVTStore } from '@/stores/pivtStore';
import { HELP_CATEGORIES, ISSUE_CATEGORIES, AFFECTED_AREAS, IMPACT_LEVELS, type HelpArticle } from './supportData';
import { supabase } from '@/integrations/supabase/client';

type Layer = 'qa' | 'ai' | 'escalation' | 'confirmation';
type AiMsg = { role: 'user' | 'assistant'; content: string };

const NEWTON_SUPPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton`;
const TICKET_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-support-ticket`;

export const SupportPanel: React.FC = () => {
  const { activeSection, selectedDealId } = usePIVTStore();
  const [isOpen, setIsOpen] = useState(false);

  // Listen for sidebar open event
  useEffect(() => {
    const handler = () => setIsOpen(true);
    window.addEventListener('pivt:open-support', handler);
    return () => window.removeEventListener('pivt:open-support', handler);
  }, []);
  const [layer, setLayer] = useState<Layer>('qa');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // AI state
  const [aiMessages, setAiMessages] = useState<AiMsg[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiScrollRef = useRef<HTMLDivElement>(null);

  // Escalation state
  const [category, setCategory] = useState('');
  const [affectedArea, setAffectedArea] = useState('');
  const [priority, setPriority] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState('');

  useEffect(() => {
    if (aiScrollRef.current) aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
  }, [aiMessages]);

  const filteredCategories = searchQuery.trim()
    ? HELP_CATEGORIES.map(cat => ({
        ...cat,
        articles: cat.articles.filter(a =>
          a.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.answer.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      })).filter(cat => cat.articles.length > 0)
    : HELP_CATEGORIES;

  const switchToAi = (initialQuery?: string) => {
    setLayer('ai');
    if (initialQuery) {
      setTimeout(() => sendAi(initialQuery), 200);
    }
  };

  const sendAi = async (text: string) => {
    if (!text.trim() || aiLoading) return;
    const userMsg: AiMsg = { role: 'user', content: text };
    const all = [...aiMessages, userMsg];
    setAiMessages(all);
    setAiInput('');
    setAiLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const bearer = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(NEWTON_SUPPORT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: all,
          dealContext: {
            supportMode: true,
            currentPage: activeSection,
            dealId: selectedDealId,
          },
        }),
      });

      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        setAiLoading(false);
        setAiMessages(p => [...p, { role: 'assistant', content: `⚠️ ${d.error || 'Error'}` }]);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setAiLoading(false); return; }
      const decoder = new TextDecoder();
      let buf = '';
      let soFar = '';

      const upsert = (chunk: string) => {
        soFar += chunk;
        setAiMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
          return [...prev, { role: 'assistant', content: soFar }];
        });
      };

      let done = false;
      while (!done) {
        const { done: rd, value } = await reader.read();
        if (rd) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || !line.trim() || !line.startsWith('data: ')) continue;
          const js = line.slice(6).trim();
          if (js === '[DONE]') { done = true; break; }
          try {
            const p = JSON.parse(js);
            const c = p.choices?.[0]?.delta?.content;
            if (c) upsert(c);
          } catch { buf = line + '\n' + buf; break; }
        }
      }
      setAiLoading(false);
    } catch {
      setAiLoading(false);
      setAiMessages(p => [...p, { role: 'assistant', content: '⚠️ Failed to connect to support AI.' }]);
    }
  };

  const submitTicket = async () => {
    if (!category || !affectedArea || !priority || description.length < 20) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(TICKET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          category,
          affectedArea,
          priority,
          description,
          metadata: {
            currentPage: activeSection,
            dealId: selectedDealId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            aiConversation: aiMessages.length > 0 ? aiMessages.slice(-4) : undefined,
          },
        }),
      });

      const result = await resp.json();
      if (resp.ok && result.ticketId) {
        setTicketId(result.ticketId);
        setLayer('confirmation');
      } else {
        alert(result.error || 'Failed to submit ticket');
      }
    } catch {
      alert('Failed to submit support ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setIsOpen(false);
    setTimeout(() => {
      setLayer('qa');
      setSearchQuery('');
      setSelectedArticle(null);
      setAiMessages([]);
      setAiInput('');
      setCategory('');
      setAffectedArea('');
      setPriority('');
      setDescription('');
      setTicketId('');
    }, 300);
  };

  return (
    <>
      {/* Floating support button */}
      <AnimatePresence>
        {!isOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-24 z-50 w-11 h-11 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center border"
                style={{
                  background: 'hsl(var(--card))',
                  color: 'hsl(var(--foreground))',
                  borderColor: 'hsl(var(--border))',
                }}
              >
                <HelpCircle className="w-5 h-5" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="left">Support & Help</TooltipContent>
          </Tooltip>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetAndClose}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={springConfig.standard}
              className="fixed top-0 right-0 bottom-0 z-50 w-[440px] max-w-[92vw] flex flex-col border-l"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
                {(layer !== 'qa' && layer !== 'confirmation') && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setLayer(layer === 'escalation' ? 'ai' : 'qa')}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                )}
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--muted))' }}>
                  <HelpCircle className="w-5 h-5" style={{ color: 'hsl(var(--foreground))' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {layer === 'qa' && 'Help & Support'}
                    {layer === 'ai' && 'AI Support Assistant'}
                    {layer === 'escalation' && 'Submit Support Ticket'}
                    {layer === 'confirmation' && 'Ticket Submitted'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {layer === 'qa' && 'Search articles or ask Newton'}
                    {layer === 'ai' && 'Powered by Newton Intelligence'}
                    {layer === 'escalation' && 'Our team will review your issue'}
                    {layer === 'confirmation' && 'We\'ll get back to you shortly'}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={resetAndClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Layer 1: Q&A */}
              {layer === 'qa' && (
                <>
                  <div className="px-5 pt-4 pb-2 shrink-0">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setSelectedArticle(null); }}
                        placeholder="Search help articles..."
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                        style={{ borderColor: 'hsl(var(--border))' }}
                      />
                    </div>
                  </div>

                  {/* Ask AI CTA */}
                  <div className="px-5 pb-3 shrink-0">
                    <button
                      onClick={() => switchToAi(searchQuery.trim() || undefined)}
                      className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left text-sm transition-colors hover:bg-muted/40"
                      style={{ borderColor: 'hsl(var(--accent) / 0.2)', background: 'hsl(var(--accent) / 0.04)' }}
                    >
                      <Sparkles className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--accent))' }} />
                      <span className="flex-1">
                        {searchQuery.trim() ? `Ask Newton: "${searchQuery}"` : 'Ask Newton AI for help'}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="px-5 pb-5 space-y-1">
                      {selectedArticle ? (
                        <div className="space-y-3">
                          <button onClick={() => setSelectedArticle(null)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="w-3 h-3" /> Back to articles
                          </button>
                          <h3 className="text-sm font-semibold">{selectedArticle.question}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{selectedArticle.answer}</p>
                          <div className="pt-3 border-t" style={{ borderColor: 'hsl(var(--border))' }}>
                            <p className="text-xs text-muted-foreground mb-2">Still need help?</p>
                            <Button size="sm" variant="outline" onClick={() => switchToAi(selectedArticle.question)}>
                              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ask Newton
                            </Button>
                          </div>
                        </div>
                      ) : (
                        filteredCategories.map(cat => (
                          <div key={cat.id}>
                            <button
                              onClick={() => setExpandedCategory(expandedCategory === cat.id ? null : cat.id)}
                              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium hover:bg-muted/40 transition-colors"
                            >
                              <span className="text-base">{cat.icon}</span>
                              <span className="flex-1 text-left">{cat.label}</span>
                              <span className="text-[10px] text-muted-foreground">{cat.articles.length}</span>
                              <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', expandedCategory === cat.id && 'rotate-90')} />
                            </button>
                            <AnimatePresence>
                              {expandedCategory === cat.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pl-10 pr-2 pb-2 space-y-0.5">
                                    {cat.articles.map(article => (
                                      <button
                                        key={article.id}
                                        onClick={() => setSelectedArticle(article)}
                                        className="w-full text-left px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                                      >
                                        {article.question}
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}

              {/* Layer 2: AI Support */}
              {layer === 'ai' && (
                <>
                  <ScrollArea className="flex-1">
                    <div ref={aiScrollRef} className="p-4 space-y-3">
                      {aiMessages.length === 0 && (
                        <div className="text-center py-6">
                          <Sparkles className="w-7 h-7 mx-auto mb-3 opacity-30" style={{ color: 'hsl(var(--accent))' }} />
                          <p className="text-sm font-medium">Newton Support Mode</p>
                          <p className="text-xs text-muted-foreground mt-1">Ask me anything about PIVT</p>
                        </div>
                      )}
                      {aiMessages.map((msg, i) => (
                        <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            'px-3.5 py-2.5 rounded-xl max-w-[90%] text-[13px] leading-relaxed',
                            msg.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-muted/40 border'
                          )} style={msg.role === 'assistant' ? { borderColor: 'hsl(var(--border))' } : undefined}>
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_code]:text-xs">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            ) : msg.content}
                          </div>
                        </div>
                      ))}
                      {aiLoading && aiMessages[aiMessages.length - 1]?.role !== 'assistant' && (
                        <div className="flex justify-start">
                          <div className="px-3.5 py-2.5 rounded-xl border" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.4)' }}>
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'hsl(var(--accent))' }} />
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Escalation CTA */}
                  {aiMessages.length >= 2 && !aiLoading && (
                    <div className="px-4 py-2 border-t shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
                      <button
                        onClick={() => setLayer('escalation')}
                        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-[12px] font-medium border transition-colors hover:bg-muted/30"
                        style={{ borderColor: 'hsl(var(--border))' }}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'hsl(var(--discrepancy))' }} />
                        <span className="flex-1 text-left">Need more help? Escalate to our technical team</span>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={e => { e.preventDefault(); sendAi(aiInput); }}
                    className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
                    style={{ borderColor: 'hsl(var(--border))' }}
                  >
                    <input
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      placeholder="Describe your issue..."
                      className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                      disabled={aiLoading}
                    />
                    <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!aiInput.trim() || aiLoading}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </form>
                </>
              )}

              {/* Layer 3: Escalation Form */}
              {layer === 'escalation' && (
                <ScrollArea className="flex-1">
                  <div className="p-5 space-y-5">
                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Issue Category</label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue placeholder="Select category..." /></SelectTrigger>
                        <SelectContent>
                          {ISSUE_CATEGORIES.map(c => (
                            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Affected Area */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Affected Area</label>
                      <Select value={affectedArea} onValueChange={setAffectedArea}>
                        <SelectTrigger><SelectValue placeholder="Select area..." /></SelectTrigger>
                        <SelectContent>
                          {AFFECTED_AREAS.map(a => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Impact */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Impact Level</label>
                      <div className="grid grid-cols-3 gap-2">
                        {IMPACT_LEVELS.map(lvl => (
                          <button
                            key={lvl.value}
                            onClick={() => setPriority(lvl.value)}
                            className={cn(
                              'px-3 py-2.5 rounded-lg border text-center transition-all text-xs font-medium',
                              priority === lvl.value
                                ? 'border-accent bg-accent/10 text-accent'
                                : 'hover:bg-muted/40'
                            )}
                            style={{ borderColor: priority === lvl.value ? undefined : 'hsl(var(--border))' }}
                          >
                            <div>{lvl.label}</div>
                            <div className="text-[10px] text-muted-foreground font-normal mt-0.5">{lvl.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</label>
                      <Textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe the issue in detail... (minimum 20 characters)"
                        className="min-h-[120px] resize-none"
                      />
                      <p className={cn('text-[10px]', description.length < 20 ? 'text-muted-foreground' : 'text-validated')}>
                        {description.length}/20 minimum characters
                      </p>
                    </div>

                    {/* Metadata note */}
                    <div className="rounded-lg border p-3 text-[11px] text-muted-foreground" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)' }}>
                      <p className="font-medium mb-1">Auto-captured diagnostics</p>
                      <p>Current page, browser info, and session data will be included to help our team resolve your issue faster.</p>
                    </div>

                    {/* Submit */}
                    <Button
                      onClick={submitTicket}
                      disabled={!category || !affectedArea || !priority || description.length < 20 || submitting}
                      className="w-full"
                    >
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {submitting ? 'Submitting...' : 'Submit Support Ticket'}
                    </Button>
                  </div>
                </ScrollArea>
              )}

              {/* Confirmation */}
              {layer === 'confirmation' && (
                <div className="flex-1 flex flex-col items-center justify-center px-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'hsl(var(--validated) / 0.1)' }}>
                    <CheckCircle2 className="w-7 h-7" style={{ color: 'hsl(var(--validated))' }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Support request submitted</p>
                    <p className="text-xs text-muted-foreground mt-1">Our technical team will review and respond shortly.</p>
                  </div>
                  <div className="px-4 py-2.5 rounded-lg border text-xs font-mono" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.3)' }}>
                    Ticket ID: {ticketId.slice(0, 8)}
                  </div>
                  <Button variant="outline" size="sm" onClick={resetAndClose}>Close</Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
