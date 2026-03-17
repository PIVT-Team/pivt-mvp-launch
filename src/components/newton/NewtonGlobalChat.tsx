/**
 * Newton Global Chat - Floating chat button + panel overlay
 * Available on any page via ⌘J keyboard shortcut
 */
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { springConfig } from '@/lib/animations';
import {
  Send, Loader2, X, Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import pivtLogo from '@/assets/pivt-logo.png';
import newtonIcon from '@/assets/newton-icon.png';

type Msg = { role: 'user' | 'assistant'; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton`;

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

export const NewtonGlobalChat: React.FC = () => {
  const deal = useSelectedDeal();
  const { activeSection } = usePIVTStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
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
        setIsMinimized(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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

    const ctx = `[Deal: ${deal.codeName} | $${(deal.consideration / 1e6).toFixed(1)}M | ${deal.status} | View: ${activeSection}]\n\n`;
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

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => { setIsOpen(true); setIsMinimized(false); }}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-accent text-accent-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
          >
            <Sparkles className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 56 : 520,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={springConfig.standard}
            className="fixed bottom-6 right-6 z-50 w-96 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <img src={pivtLogo} alt="Newton" className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Newton</p>
                <p className="text-[10px] text-muted-foreground truncate">{deal.codeName} · AI Intelligence</p>
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
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-8">
                      <Sparkles className="w-6 h-6 text-accent mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-muted-foreground">Ask Newton about {deal.codeName}</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'px-3 py-2 rounded-xl max-w-[85%] text-sm',
                        msg.role === 'user'
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-muted/50 border border-border'
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
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <form
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-center gap-2 px-3 py-2 border-t border-border"
                >
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask Newton..."
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                    disabled={isLoading}
                  />
                  <Button type="submit" size="icon" className="h-7 w-7 shrink-0" disabled={!input.trim() || isLoading}>
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
