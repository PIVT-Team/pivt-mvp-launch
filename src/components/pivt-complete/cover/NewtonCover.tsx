import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { springConfig } from '@/lib/animations';
import {
  Bot, Send, Loader2, Sparkles, Command, Plus, History,
  Trash2, AlertTriangle, CheckCircle2, TrendingUp, Users,
  FileText, Shield, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import pivtLogo from '@/assets/pivt-logo.png';

// ------- Types -------
type Msg = { role: 'user' | 'assistant' | 'system'; content: string; timestamp: number; action?: any };

interface Conversation {
  id: string;
  title: string;
  messages: Msg[];
  createdAt: number;
  updatedAt: number;
}

// ------- Streaming -------
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton`;

async function streamChat({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: { role: string; content: string }[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });

  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    onError(data.error || `Error ${resp.status}`);
    return;
  }
  if (!resp.body) { onError('No response body'); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nlIdx: number;
    while ((nlIdx = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, nlIdx);
      buffer = buffer.slice(nlIdx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.startsWith(':') || line.trim() === '') continue;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === '[DONE]') { streamDone = true; break; }
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + '\n' + buffer;
        break;
      }
    }
  }

  // flush
  if (buffer.trim()) {
    for (let raw of buffer.split('\n')) {
      if (!raw) continue;
      if (raw.endsWith('\r')) raw = raw.slice(0, -1);
      if (!raw.startsWith('data: ')) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === '[DONE]') continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {}
    }
  }
  onDone();
}

// ------- Context-aware suggestions -------
const DEAL_SUGGESTIONS = [
  'Summarize the closing readiness for this deal',
  'What discrepancies should I watch for in the waterfall?',
  'Explain the escrow release timeline and holdback structure',
  'Who are the key stakeholders and what is their KYC status?',
  'Walk me through the payment execution workflow',
  'What are the biggest risks to closing on schedule?',
];

const getSectionSuggestions = (section: string): string[] => {
  const map: Record<string, string[]> = {
    command: ['Give me an executive summary of deal readiness', 'What needs my attention right now?'],
    waterfall: ['Verify the waterfall tiers reconcile to deal value', 'Explain the preferred return calculation'],
    stakeholders: ['Which stakeholders have incomplete KYC?', 'Summarize ownership distribution'],
    documents: ['Are there any document discrepancies?', 'What documents are still pending review?'],
    escrow: ['When is the next escrow release?', 'What are the indemnity holdback terms?'],
    approvals: ['What approvals are blocking closing?', 'Summarize critical pending approvals'],
    payments: ['What payments are ready to execute?', 'Show me the payment batch status'],
    closing: ['What is the wire verification status?', 'Are all bank details confirmed?'],
  };
  return map[section] || [];
};

// ------- Intelligence Cards -------
const IntelligenceCard: React.FC<{ type: string; data: any }> = ({ type, data }) => {
  const iconMap: Record<string, React.ElementType> = {
    risk: AlertTriangle,
    status: CheckCircle2,
    metric: TrendingUp,
    stakeholder: Users,
    document: FileText,
    compliance: Shield,
  };
  const Icon = iconMap[type] || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-accent" />
        <span className="text-xs font-medium uppercase text-muted-foreground">{data.title || type}</span>
      </div>
      {data.value && <p className="font-mono text-lg font-semibold">{data.value}</p>}
      {data.description && <p className="text-sm text-muted-foreground">{data.description}</p>}
      {data.items && (
        <div className="space-y-1">
          {data.items.map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

// ------- Newton Panel (sidebar section) -------
export const NewtonCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { activeSection } = usePIVTStore();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]') || scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Keyboard shortcut ⌘N
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Contextual greeting
  const getGreeting = useCallback(() => {
    const greetings: Record<string, string> = {
      command: `I can provide an executive overview of ${deal.codeName}, identify risks, and summarize what needs your attention.`,
      deals: `I can help you compare deals, analyze portfolio exposure, and identify cross-deal patterns.`,
      waterfall: `I can verify waterfall calculations, check tier reconciliation, and explain distribution mechanics.`,
      stakeholders: `I can review KYC status, flag missing documentation, and summarize ownership structures.`,
      documents: `I can identify document discrepancies, cross-reference data points, and flag missing filings.`,
      escrow: `I can explain escrow terms, calculate release timelines, and verify holdback amounts.`,
      approvals: `I can prioritize pending approvals, identify bottlenecks, and suggest routing optimizations.`,
      payments: `I can review payment batches, verify wire instructions, and track execution status.`,
      closing: `I can assess closing readiness, identify blocking items, and recommend next steps.`,
    };
    return greetings[activeSection] || `Ask me anything about ${deal.codeName}. I have full oversight of the deal structure, stakeholders, documents, and financials.`;
  }, [activeSection, deal.codeName]);

  // Initialize with greeting
  useEffect(() => {
    if (messages.length === 0 && !activeConvId) {
      setMessages([{ role: 'system', content: getGreeting(), timestamp: Date.now() }]);
    }
  }, [activeSection]);

  const newConversation = () => {
    const id = Math.random().toString(36).slice(2, 10);
    if (messages.length > 1) {
      const title = messages.find(m => m.role === 'user')?.content.slice(0, 50) || 'Untitled';
      setConversations(prev => [{
        id: activeConvId || Math.random().toString(36).slice(2, 10),
        title,
        messages: [...messages],
        createdAt: messages[0]?.timestamp || Date.now(),
        updatedAt: Date.now(),
      }, ...prev].slice(0, 20));
    }
    setMessages([{ role: 'system', content: getGreeting(), timestamp: Date.now() }]);
    setActiveConvId(id);
    setShowHistory(false);
  };

  const loadConversation = (conv: Conversation) => {
    setMessages(conv.messages);
    setActiveConvId(conv.id);
    setShowHistory(false);
  };

  const deleteConversation = (id: string) => {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvId === id) newConversation();
  };

  const contextPrefix = useCallback(() => {
    return `[Active deal: ${deal.codeName} — ${deal.buyerName} acquiring ${deal.targetCompany} for $${(deal.consideration / 1e6).toFixed(1)}M | Status: ${deal.status} | Closing: ${deal.closingDate} | ${deal.totalRecipients} recipients | ${deal.documentsUploaded} docs uploaded | ${deal.discrepanciesFound} discrepancies | ${deal.readyToPayPercent}% ready to pay | Current view: ${activeSection}]\n\n`;
  }, [deal, activeSection]);

  const send = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setError(null);

    const userMsg: Msg = { role: 'user', content: text, timestamp: Date.now() };
    const allMsgs = [...messages.filter(m => m.role !== 'system'), userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // Build API messages with context
    const apiMessages = allMsgs.map((m, i) => {
      if (i === 0 && m.role === 'user') {
        return { role: m.role, content: contextPrefix() + m.content };
      }
      return { role: m.role, content: m.content };
    });

    let assistantSoFar = '';
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: 'assistant', content: assistantSoFar, timestamp: Date.now() }];
      });
    };

    try {
      await streamChat({
        messages: apiMessages,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        onError: (err) => {
          setError(err);
          setIsLoading(false);
          toast.error(err);
        },
      });
    } catch (e) {
      console.error(e);
      setError('Failed to connect to Newton');
      setIsLoading(false);
    }
  };

  const suggestions = [
    ...getSectionSuggestions(activeSection),
    ...DEAL_SUGGESTIONS.slice(0, 4 - getSectionSuggestions(activeSection).length),
  ].slice(0, 4);

  return (
    <div className="relative flex flex-col h-[calc(100vh-8rem)]">
      {/* Neural mesh background — AI page only */}
      <div className="pivt-neural-mesh" />
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <img src={pivtLogo} alt="Newton" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Newton</h2>
            <p className="text-xs text-muted-foreground">
              Deal intelligence · {deal.codeName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={newConversation}>
            <Plus className="w-4 h-4 mr-1" /> New
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" /> History
          </Button>
        </div>
      </div>

      {/* History dropdown */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border"
          >
            <div className="py-3 space-y-1 max-h-48 overflow-y-auto">
              {conversations.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 py-4 text-center">No conversation history yet</p>
              ) : (
                conversations.map(conv => (
                  <div key={conv.id} className="flex items-center justify-between group px-2 py-2 rounded-lg hover:bg-muted/50">
                    <button onClick={() => loadConversation(conv)} className="flex-1 text-left">
                      <p className="text-xs font-medium truncate">{conv.title}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(conv.updatedAt).toLocaleDateString()}</p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={() => deleteConversation(conv.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4" ref={scrollRef}>
        <div className="space-y-4 pr-2">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springConfig.standard}
              className={cn('flex gap-3', msg.role === 'user' && 'justify-end')}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 text-accent" />
                </div>
              )}
              <div className={cn(
                'px-4 py-3 rounded-xl max-w-[80%]',
                msg.role === 'user'
                  ? 'bg-accent text-accent-foreground'
                  : msg.role === 'system'
                    ? 'bg-muted/50 text-muted-foreground text-sm'
                    : 'bg-card border border-border'
              )}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_code]:text-xs [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_p]:my-1.5 [&_ul]:my-1.5 [&_li]:my-0.5">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
                {msg.action && (
                  <Badge variant="outline" className="mt-2 text-xs">
                    Action: {msg.action.type}
                  </Badge>
                )}
              </div>
            </motion.div>
          ))}

          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-accent animate-spin" />
              </div>
              <div className="px-4 py-3 rounded-xl bg-card border border-border">
                <p className="text-sm text-muted-foreground">Processing your request...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-center">
              <div className="bg-blocking/10 text-blocking text-xs px-3 py-2 rounded-lg">{error}</div>
            </div>
          )}

          {/* Suggestions */}
          {messages.length <= 1 && !isLoading && (
            <div className="space-y-3 pt-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Suggested queries</p>
              <div className="grid grid-cols-1 gap-2">
                {suggestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    className="pivt-card p-3 text-xs text-left hover:border-accent/50 hover:text-accent transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="pt-3 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex items-center gap-2 bg-muted/30 border border-border rounded-xl p-2">
          <Command className="w-4 h-4 text-muted-foreground ml-2 shrink-0" />
          <input
            ref={inputRef}
            placeholder="Ask Newton anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-transparent border-0 text-sm focus:outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={!input.trim() || isLoading}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground mt-1.5 ml-2">
          <kbd className="px-1 bg-muted rounded text-[10px]">⌘N</kbd> to focus · <kbd className="px-1 bg-muted rounded text-[10px]">⌘J</kbd> floating chat
        </p>
      </div>
    </div>
  );
};
