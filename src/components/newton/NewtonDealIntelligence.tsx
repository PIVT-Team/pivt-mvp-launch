/**
 * Newton – Deal Intelligence Engine
 * Floating AI assistant with role-aware, context-aware structured responses
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { springConfig } from '@/lib/animations';
import {
  Sparkles, Send, Loader2, X, ChevronRight,
  ShieldAlert, CheckCircle2, AlertTriangle, Clock, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from '@/components/ui/scroll-area';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton`;

const QUICK_PROMPTS = [
  { label: 'What are the blockers?', icon: ShieldAlert },
  { label: 'Is this deal safe to close?', icon: CheckCircle2 },
  { label: 'Summarize deal health', icon: Zap },
  { label: 'What approvals are outstanding?', icon: Clock },
  { label: 'What changed recently?', icon: AlertTriangle },
  { label: 'What is the closing probability?', icon: Sparkles },
];

async function streamChat(
  messages: { role: string; content: string }[],
  dealContext: Record<string, unknown>,
  onDelta: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, dealContext }),
  });
  if (!resp.ok) {
    const d = await resp.json().catch(() => ({}));
    onError(d.error || `Error ${resp.status}`);
    return;
  }
  if (!resp.body) { onError('No body'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
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
        if (c) onDelta(c);
      } catch { buf = line + '\n' + buf; break; }
    }
  }
  onDone();
}

export const NewtonDealIntelligence: React.FC = () => {
  const deal = useSelectedDeal();
  const { activeSection, stakeholders, documents, payments, waterfallTiers, pendingApprovals } = usePIVTStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ⌘J toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen(p => !p);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for search-to-Newton handoff
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.query) {
        setIsOpen(true);
        setTimeout(() => send(detail.query), 300);
      }
    };
    window.addEventListener('pivt:open-newton', handler);
    return () => window.removeEventListener('pivt:open-newton', handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const buildDealContext = () => ({
    deal: {
      name: deal.name,
      codeName: deal.codeName,
      consideration: deal.consideration,
      status: deal.status,
      workflowState: deal.workflowState,
      buyerName: deal.buyerName,
      targetCompany: deal.targetCompany,
      sector: deal.sector,
      totalRecipients: deal.totalRecipients,
      documentsUploaded: deal.documentsUploaded,
      discrepanciesFound: deal.discrepanciesFound,
      readyToPayPercent: deal.readyToPayPercent,
      closingDate: deal.closingDate,
      pendingApprovals: deal.pendingApprovals,
      hasBlocker: deal.hasBlocker,
    },
    stakeholders: stakeholders.map(s => ({
      name: s.name, role: s.role, kycStatus: s.kycStatus,
      payoutAmount: s.payoutAmount, ownershipPct: s.ownershipPct,
    })),
    documents: documents.map(d => ({
      name: d.name, type: d.type, status: d.status, uploadedAt: d.uploadedAt,
    })),
    payments: payments.map(p => ({
      recipientName: p.recipientName, amount: p.amount, status: p.status,
    })),
    waterfallTiers: waterfallTiers.map(w => ({
      name: w.name, amount: w.amount, percentage: w.percentage, recipients: w.recipients,
    })),
    pendingApprovals: pendingApprovals.map(a => ({
      type: a.type, dealName: a.dealName, description: a.description,
      urgency: a.urgency, createdAt: a.createdAt,
    })),
    currentView: activeSection,
  });

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const all = [...messages, userMsg];
    setMessages(all);
    setInput('');
    setIsLoading(true);

    let soFar = '';
    const upsert = (chunk: string) => {
      soFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: soFar } : m);
        return [...prev, { role: 'assistant', content: soFar }];
      });
    };

    try {
      await streamChat(all, buildDealContext(), upsert, () => setIsLoading(false), (err) => {
        setIsLoading(false);
        setMessages(p => [...p, { role: 'assistant', content: `⚠️ ${err}` }]);
      });
    } catch {
      setIsLoading(false);
      setMessages(p => [...p, { role: 'assistant', content: '⚠️ Failed to connect' }]);
    }
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group pivt-gradient-interactive"
                style={{
                  background: 'var(--pivt-gradient-primary)',
                  color: '#FFFFFF',
                  boxShadow: 'var(--pivt-gradient-glow)',
                }}
              >
                <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="left">Ask PIVT AI</TooltipContent>
          </Tooltip>
        )}
      </AnimatePresence>

      {/* Right-side drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={springConfig.standard}
              className="fixed top-0 right-0 bottom-0 z-50 w-[420px] max-w-[90vw] flex flex-col border-l"
              style={{
                background: 'hsl(var(--card))',
                borderColor: 'hsl(var(--border))',
              }}
            >
              {/* Header */}
              <div className="px-5 py-4 border-b flex items-center gap-3 shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--accent) / 0.15)' }}>
                  <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--accent))' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Newton – Deal Intelligence</p>
                  <p className="text-[10px] text-muted-foreground">Workflow & Risk Analysis Engine</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full border font-mono" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                  {deal.codeName}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1">
                <div ref={scrollRef} className="p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="space-y-4">
                      <div className="text-center py-4">
                        <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: 'hsl(var(--accent))' }} />
                        <p className="text-sm font-medium">Deal Intelligence Ready</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Scoped to <span className="font-semibold">{deal.codeName}</span> · {deal.workflowState.replace('_', ' ')}
                        </p>
                      </div>

                      {/* Quick action buttons */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">Quick Analysis</p>
                        {QUICK_PROMPTS.map((prompt) => (
                          <button
                            key={prompt.label}
                            onClick={() => send(prompt.label)}
                            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left text-[13px] border transition-colors hover:bg-muted/50"
                            style={{ borderColor: 'hsl(var(--border))' }}
                          >
                            <prompt.icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1">{prompt.label}</span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground opacity-40" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'px-3.5 py-2.5 rounded-xl max-w-[90%] text-[13px] leading-relaxed',
                        msg.role === 'user'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted/40 border'
                      )} style={msg.role === 'assistant' ? { borderColor: 'hsl(var(--border))' } : undefined}>
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_code]:text-xs [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_strong]:text-foreground">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : msg.content}
                      </div>
                    </div>
                  ))}

                  {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                    <div className="flex justify-start">
                      <div className="px-3.5 py-2.5 rounded-xl border" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--muted) / 0.4)' }}>
                        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'hsl(var(--accent))' }} />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Quick prompts when in conversation */}
              {messages.length > 0 && !isLoading && (
                <div className="px-3 py-2 border-t flex gap-1.5 overflow-x-auto shrink-0" style={{ borderColor: 'hsl(var(--border))' }}>
                  {QUICK_PROMPTS.slice(0, 3).map((p) => (
                    <button
                      key={p.label}
                      onClick={() => send(p.label)}
                      className="text-[10px] px-2.5 py-1.5 rounded-full border whitespace-nowrap hover:bg-muted/50 transition-colors text-muted-foreground"
                      style={{ borderColor: 'hsl(var(--border))' }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <form
                onSubmit={(e) => { e.preventDefault(); send(input); }}
                className="flex items-center gap-2 px-4 py-3 border-t shrink-0"
                style={{ borderColor: 'hsl(var(--border))' }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask Newton about this deal..."
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                  disabled={isLoading}
                />
                <kbd className="px-1.5 py-0.5 text-[9px] rounded border font-mono text-muted-foreground opacity-50" style={{ borderColor: 'hsl(var(--border))' }}>⌘J</kbd>
                <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!input.trim() || isLoading}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default NewtonDealIntelligence;
