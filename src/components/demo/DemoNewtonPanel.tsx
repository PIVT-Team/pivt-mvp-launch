/**
 * Simulated Newton chat panel for the demo flow.
 * Messages stream in with typing indicators.
 * Includes a simulated input bar with character-by-character typing.
 */
import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, Terminal, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export interface DemoMsg {
  id: string;
  type: 'user' | 'newton' | 'system' | 'thinking';
  text: string;
  visible: boolean;
  streaming?: boolean;
}

interface Props {
  messages: DemoMsg[];
  isTyping: boolean;
  /** Text currently being "typed" in the input bar */
  typingText?: string;
  /** Whether the input should appear focused */
  isInputFocused?: boolean;
}

export const DemoNewtonPanel: React.FC<Props> = ({
  messages,
  isTyping,
  typingText = '',
  isInputFocused = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping, typingText]);

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
        >
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
          {messages
            .filter((m) => m.visible)
            .map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
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
                {msg.type === 'thinking' && (
                  <div className="rounded-2xl border border-accent/15 bg-accent/5 p-3.5">
                    <div className="flex items-center gap-2.5">
                      <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0" />
                      <span className="text-[13px] text-accent/80 font-medium">{msg.text}</span>
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-3 py-2"
          >
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />
            <span className="text-[12px] text-muted-foreground">Newton is thinking...</span>
          </motion.div>
        )}
      </div>

      {/* Input area — simulated with typing animation */}
      <div className="px-4 py-3 border-t border-border">
        <div
          className={`flex items-end gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 ${
            isInputFocused
              ? 'bg-background border-accent/30 ring-1 ring-accent/20'
              : 'bg-muted/50 border-border'
          }`}
        >
          <div className="flex-1 min-h-[20px] text-[13px] leading-snug relative">
            {typingText ? (
              <span className="text-foreground">
                {typingText}
                <motion.span
                  className="inline-block w-[2px] h-[14px] bg-accent ml-[1px] align-middle rounded-full"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                />
              </span>
            ) : (
              <span className="text-muted-foreground/50">
                {isInputFocused ? (
                  <motion.span
                    className="inline-block w-[2px] h-[14px] bg-accent/60 align-middle rounded-full"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
                  />
                ) : (
                  'Ask Newton to work on this deal...'
                )}
              </span>
            )}
          </div>
          <motion.div
            animate={{
              scale: typingText ? 1.05 : 1,
              opacity: typingText ? 1 : 0.4,
            }}
            transition={{ duration: 0.15 }}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                typingText
                  ? 'bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};
