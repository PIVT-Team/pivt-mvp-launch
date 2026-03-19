/**
 * Simulated Newton chat panel for the demo flow.
 * Messages stream in with typing indicators.
 */
import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, User, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface DemoMsg {
  id: string;
  type: 'user' | 'newton' | 'system';
  text: string;
  visible: boolean;
  streaming?: boolean;
}

interface Props {
  messages: DemoMsg[];
  isTyping: boolean;
}

export const DemoNewtonPanel: React.FC<Props> = ({ messages, isTyping }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}>
          <Sparkles className="w-3.5 h-3.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold">Newton</p>
          <p className="text-[10px] text-muted-foreground">AI Deal Copilot</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-validated animate-pulse" />
          <span className="text-[10px] text-muted-foreground">Active</span>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <AnimatePresence initial={false}>
          {messages.filter(m => m.visible).map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {msg.type === 'user' && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-[13px] leading-relaxed">
                    {msg.text}
                  </div>
                </div>
              )}
              {msg.type === 'newton' && (
                <div className="rounded-2xl border border-border bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span className="text-[11px] font-medium text-accent">Newton</span>
                  </div>
                  <div className="text-[13px] text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground">
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                </div>
              )}
              {msg.type === 'system' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-validated/5 border border-validated/15">
                  <Terminal className="w-3 h-3 text-validated" />
                  <span className="text-[11px] text-validated font-medium">{msg.text}</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            <span className="text-[12px] text-muted-foreground">Newton is thinking...</span>
          </motion.div>
        )}
      </div>

      {/* Input area (decorative) */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border">
          <span className="text-[12px] text-muted-foreground/50">Ask Newton to work on this deal...</span>
        </div>
      </div>
    </div>
  );
};
