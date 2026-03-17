/**
 * Newton Global Chat - Floating launcher + structured modal overlay
 * Available on any page via ⌘J keyboard shortcut
 * v2 — Structured layout with deal context selector and quick actions
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { springConfig } from '@/lib/animations';
import {
  Send, Loader2, X, Minus, Upload, Users, FileText, DollarSign,
  Landmark, Receipt, CheckSquare, Shield, Sparkles, ChevronDown,
  Plus, FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import newtonIcon from '@/assets/newton-icon.png';

// ── Types ──────────────────────────────────────────────────────────
type Msg = { role: 'user' | 'assistant'; content: string };
type DealMode = 'demo' | 'my';

interface RealDealOption { id: string; deal_name: string; deal_number: string; is_demo: boolean; visibility: string }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton`;

// ── Quick Actions ──────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: Upload, label: 'Import Stakeholders', prompt: 'Import stakeholder spreadsheet', color: 'text-blue-600' },
  { icon: Users, label: 'Send KYC Requests', prompt: 'Generate KYC/KYB requests', color: 'text-emerald-600' },
  { icon: DollarSign, label: 'Review Funds Flow', prompt: 'Parse funds flow', color: 'text-amber-600' },
  { icon: Landmark, label: 'Match Wire Instructions', prompt: 'Match wire instructions', color: 'text-violet-600' },
  { icon: FileText, label: 'Review Agreements', prompt: 'Review deal documents for payment obligations', color: 'text-rose-600' },
  { icon: CheckSquare, label: 'Prepare Closing', prompt: 'Prepare deal for closing', color: 'text-cyan-600' },
] as const;

// ── Stream helper ──────────────────────────────────────────────────
async function streamChat(
  messages: { role: string; content: string }[],
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
    body: JSON.stringify({ messages }),
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

// ── Component ──────────────────────────────────────────────────────
export const NewtonGlobalChat: React.FC = () => {
  const demoDeal = useSelectedDeal();
  const { activeSection } = usePIVTStore();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Deal context
  const [dealMode, setDealMode] = useState<DealMode>('demo');
  const [selectedDemoDealId, setSelectedDemoDealId] = useState(demoDeal.id);
  const [selectedRealDealId, setSelectedRealDealId] = useState<string | null>(null);
  const [realDeals, setRealDeals] = useState<RealDealOption[]>([]);
  const [showDealDropdown, setShowDealDropdown] = useState(false);

  const demoDeals = usePIVTStore(s => s.deals);

  // Fetch user deals
  useEffect(() => {
    if (!user) return;
    supabase
      .from('deals')
      .select('id, deal_name, deal_number, is_demo, visibility')
      .eq('owner_id', user.id)
      .eq('visibility', 'private')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRealDeals(data);
      });
  }, [user, isOpen]);

  // Current deal context
  const currentDealLabel = useMemo(() => {
    if (dealMode === 'demo') {
      const d = demoDeals.find(d => d.id === selectedDemoDealId);
      return d ? `${d.name} (Demo)` : 'Select a deal';
    }
    const d = realDeals.find(d => d.id === selectedRealDealId);
    return d ? d.deal_name : null;
  }, [dealMode, selectedDemoDealId, selectedRealDealId, demoDeals, realDeals]);

  const hasDealSelected = dealMode === 'demo' ? !!selectedDemoDealId : !!selectedRealDealId;

  // ⌘J toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsOpen(p => !p);
        setIsMinimized(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Listen for pivt:open-newton event
  useEffect(() => {
    const handler = () => { setIsOpen(true); setIsMinimized(false); };
    window.addEventListener('pivt:open-newton', handler);
    return () => window.removeEventListener('pivt:open-newton', handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    const all = [...messages, userMsg];
    setMessages(all);
    setInput('');
    setIsLoading(true);

    const dealCtx = dealMode === 'demo'
      ? `[Deal: ${demoDeals.find(d => d.id === selectedDemoDealId)?.codeName || 'ATLAS'} | Demo | View: ${activeSection}]`
      : `[Deal: ${realDeals.find(d => d.id === selectedRealDealId)?.deal_name || 'Unknown'} | Live | View: ${activeSection}]`;

    const ctx = dealCtx + '\n\n';
    const apiMsgs = all.map((m, i) => i === 0 && m.role === 'user' ? { ...m, content: ctx + m.content } : m);

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
      await streamChat(apiMsgs, upsert, () => setIsLoading(false), (err) => {
        setIsLoading(false);
        setMessages(p => [...p, { role: 'assistant', content: `⚠️ ${err}` }]);
      });
    } catch {
      setIsLoading(false);
      setMessages(p => [...p, { role: 'assistant', content: '⚠️ Failed to connect' }]);
    }
  };

  const handleQuickAction = (prompt: string) => {
    if (!hasDealSelected && dealMode === 'my') return;
    send(prompt);
  };

  return (
    <>
      {/* ── Floating Launcher ── */}
      <AnimatePresence>
        {!isOpen && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => { setIsOpen(true); setIsMinimized(false); }}
                  className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(199 89% 48%))' }}
                >
                  <img src={newtonIcon} alt="Newton" className="w-8 h-8 drop-shadow-sm" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                className="bg-yellow-400 text-yellow-950 border-yellow-500 font-semibold"
              >
                Ask the Newton chatbot
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </AnimatePresence>

      {/* ── Chat Modal ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, height: isMinimized ? 56 : 600 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={springConfig.standard}
            className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] rounded-2xl border border-border bg-background shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, hsl(217 91% 60%), hsl(199 89% 48%))' }}
              >
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">Newton</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {currentDealLabel || 'Select a deal'} · AI Intelligence
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsMinimized(!isMinimized)}>
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            {!isMinimized && (
              <>
                {/* Deal Context Selector */}
                <div className="px-4 py-2 border-b border-border shrink-0">
                  {/* Mode tabs */}
                  <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50 mb-2">
                    <button
                      onClick={() => setDealMode('demo')}
                      className={cn(
                        'flex-1 text-xs font-medium py-1.5 rounded-md transition-all',
                        dealMode === 'demo'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Demo Deals
                    </button>
                    <button
                      onClick={() => setDealMode('my')}
                      className={cn(
                        'flex-1 text-xs font-medium py-1.5 rounded-md transition-all',
                        dealMode === 'my'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      My Deals
                    </button>
                  </div>

                  {/* Deal dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowDealDropdown(!showDealDropdown)}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-border hover:border-primary/30 transition-colors text-left"
                    >
                      <span className="text-xs text-foreground truncate">
                        {currentDealLabel || 'Select a deal…'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {hasDealSelected && (
                          <Badge variant="outline" className={cn(
                            'text-[9px] px-1.5 py-0',
                            dealMode === 'demo' ? 'border-amber-300 text-amber-700 bg-amber-50' : 'border-emerald-300 text-emerald-700 bg-emerald-50'
                          )}>
                            {dealMode === 'demo' ? 'Demo' : 'Live'}
                          </Badge>
                        )}
                        <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', showDealDropdown && 'rotate-180')} />
                      </div>
                    </button>

                    {showDealDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {dealMode === 'demo' ? (
                          demoDeals.map(d => (
                            <button
                              key={d.id}
                              onClick={() => { setSelectedDemoDealId(d.id); setShowDealDropdown(false); }}
                              className={cn(
                                'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors flex items-center justify-between',
                                selectedDemoDealId === d.id && 'bg-primary/5 text-primary'
                              )}
                            >
                              <span>{d.name}</span>
                              <span className="text-muted-foreground">${(d.consideration / 1e6).toFixed(0)}M</span>
                            </button>
                          ))
                        ) : realDeals.length > 0 ? (
                          realDeals.map(d => (
                            <button
                              key={d.id}
                              onClick={() => { setSelectedRealDealId(d.id); setShowDealDropdown(false); }}
                              className={cn(
                                'w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors',
                                selectedRealDealId === d.id && 'bg-primary/5 text-primary'
                              )}
                            >
                              {d.deal_name}
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                            No deals yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Main content area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto">
                  {/* No deal selected in My Deals mode */}
                  {dealMode === 'my' && !selectedRealDealId && (
                    <div className="px-4 py-6 text-center space-y-3">
                      <p className="text-sm text-muted-foreground">Select a deal to continue</p>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowDealDropdown(true)}>
                          <FolderOpen className="w-3.5 h-3.5" /> Choose Existing Deal
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Plus className="w-3.5 h-3.5" /> Create New Deal
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Upload className="w-3.5 h-3.5" /> Upload Deal Documents
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.length > 0 && (
                    <div className="px-4 py-3 space-y-3">
                      {messages.map((msg, i) => (
                        <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                          <div className={cn(
                            'px-3 py-2 rounded-xl max-w-[85%] text-sm',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted/50 border border-border text-foreground'
                          )}>
                            {msg.role === 'assistant' ? (
                              <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_code]:text-xs">
                                <ReactMarkdown>{msg.content}</ReactMarkdown>
                              </div>
                            ) : msg.content}
                          </div>
                        </div>
                      ))}
                      {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
                        <div className="flex justify-start">
                          <div className="px-3 py-2 rounded-xl bg-muted/50 border border-border">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Suggested Tasks (show when no messages and deal selected) */}
                  {messages.length === 0 && (hasDealSelected || dealMode === 'demo') && (
                    <div className="px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
                        What would you like Newton to do?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {QUICK_ACTIONS.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleQuickAction(action.prompt)}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/30 transition-all text-left group"
                          >
                            <action.icon className={cn('w-4 h-4 shrink-0', action.color)} />
                            <span className="text-xs text-foreground leading-tight">{action.label}</span>
                          </button>
                        ))}
                      </div>

                      {/* Secondary actions */}
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
                        {[
                          { icon: Receipt, label: 'Review tax forms' },
                          { icon: CheckSquare, label: 'Send approvals via DocuSign' },
                          { icon: Shield, label: 'Check closing readiness' },
                        ].map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleQuickAction(action.label)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-border hover:border-primary/20 hover:bg-muted/30 transition-all text-left group"
                          >
                            <action.icon className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                            <span className="text-[11px] text-muted-foreground group-hover:text-foreground whitespace-nowrap">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <form
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-center gap-2 px-3 py-2.5 border-t border-border shrink-0"
                >
                  <button
                    type="button"
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
                    title="Upload files"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Newton…"
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                    disabled={isLoading || (dealMode === 'my' && !selectedRealDealId)}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={!input.trim() || isLoading || (dealMode === 'my' && !selectedRealDealId)}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NewtonGlobalChat;
