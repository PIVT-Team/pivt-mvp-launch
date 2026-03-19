/**
 * Newton Chat Stream — Card-based message display.
 * Message types: user, response, success, insight, alert
 */
import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  CheckCircle2, AlertTriangle, Sparkles, ArrowRight, Loader2, Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ChatMessage {
  id: string;
  type: 'user' | 'response' | 'success' | 'insight' | 'alert' | 'loading' | 'wirepack_success';
  text: string;
  title?: string;
  actions?: { label: string; prompt: string; primary?: boolean }[];
  timestamp: Date;
  /** Extra metadata for wirepack_success cards */
  wirepackMeta?: { dealName: string; totalAmount?: string; wireCount?: number };
}

interface Props {
  messages: ChatMessage[];
  onAction?: (prompt: string) => void;
}

const messageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

export const NewtonChatStream: React.FC<Props> = ({ messages, onAction }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      <AnimatePresence initial={false}>
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            variants={messageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {msg.type === 'user' && <UserMessage text={msg.text} />}
            {msg.type === 'response' && <ResponseCard msg={msg} onAction={onAction} />}
            {msg.type === 'success' && <SuccessCard msg={msg} onAction={onAction} />}
            {msg.type === 'insight' && <InsightCard msg={msg} onAction={onAction} />}
            {msg.type === 'alert' && <AlertCard msg={msg} onAction={onAction} />}
            {msg.type === 'loading' && <LoadingCard text={msg.text} />}
          </motion.div>
        ))}
      </AnimatePresence>

      {messages.length === 0 && <EmptyState />}
    </div>
  );
};

/* ── User Message ── */
const UserMessage: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex justify-end">
    <div className="max-w-[85%] px-3.5 py-2 rounded-2xl rounded-br-md bg-primary text-primary-foreground text-[13px] leading-relaxed">
      {text}
    </div>
  </div>
);

/* ── Response Card ── */
const ResponseCard: React.FC<{ msg: ChatMessage; onAction?: (p: string) => void }> = ({ msg, onAction }) => (
  <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
    {msg.title && (
      <div className="flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-accent" />
        <span className="text-sm font-semibold">{msg.title}</span>
      </div>
    )}
    <div className="text-[13px] text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
      <ReactMarkdown>{msg.text}</ReactMarkdown>
    </div>
    {msg.actions && msg.actions.length > 0 && (
      <div className="flex flex-wrap gap-2 pt-1">
        {msg.actions.map((a, i) => (
          <Button
            key={i}
            size="sm"
            variant={a.primary ? 'default' : 'outline'}
            className={cn(
              'h-8 text-xs rounded-lg',
              a.primary && 'bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90'
            )}
            onClick={() => onAction?.(a.prompt)}
          >
            {a.label}
            {a.primary && <ArrowRight className="w-3 h-3 ml-1" />}
          </Button>
        ))}
      </div>
    )}
  </div>
);

/* ── Success Card ── */
const SuccessCard: React.FC<{ msg: ChatMessage; onAction?: (p: string) => void }> = ({ msg, onAction }) => (
  <div className="rounded-2xl border border-validated/20 bg-validated/5 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <CheckCircle2 className="w-4 h-4 text-validated" />
      <span className="text-sm font-semibold">{msg.title || 'Success'}</span>
    </div>
    <div className="text-[13px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
      <ReactMarkdown>{msg.text}</ReactMarkdown>
    </div>
    {msg.actions && msg.actions.length > 0 && (
      <div className="flex flex-wrap gap-2 pt-1">
        {msg.actions.map((a, i) => (
          <Button
            key={i}
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-lg"
            onClick={() => onAction?.(a.prompt)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    )}
  </div>
);

/* ── Insight Card ── */
const InsightCard: React.FC<{ msg: ChatMessage; onAction?: (p: string) => void }> = ({ msg, onAction }) => (
  <div className="rounded-2xl border border-accent/20 bg-accent/5 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Sparkles className="w-3.5 h-3.5 text-accent" />
      <span className="text-sm font-semibold">{msg.title || 'Insight'}</span>
    </div>
    <div className="text-[13px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
      <ReactMarkdown>{msg.text}</ReactMarkdown>
    </div>
    {msg.actions && msg.actions.length > 0 && (
      <div className="flex flex-wrap gap-2 pt-1">
        {msg.actions.map((a, i) => (
          <Button
            key={i}
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-lg border-accent/20 text-accent hover:bg-accent/10"
            onClick={() => onAction?.(a.prompt)}
          >
            {a.label}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        ))}
      </div>
    )}
  </div>
);

/* ── Alert Card ── */
const AlertCard: React.FC<{ msg: ChatMessage; onAction?: (p: string) => void }> = ({ msg, onAction }) => (
  <div className="rounded-2xl border border-blocking/20 bg-blocking/5 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-blocking" />
      <span className="text-sm font-semibold">{msg.title || 'Alert'}</span>
    </div>
    <div className="text-[13px] text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5">
      <ReactMarkdown>{msg.text}</ReactMarkdown>
    </div>
    {msg.actions && msg.actions.length > 0 && (
      <div className="flex flex-wrap gap-2 pt-1">
        {msg.actions.map((a, i) => (
          <Button
            key={i}
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-lg border-blocking/20"
            onClick={() => onAction?.(a.prompt)}
          >
            {a.label}
          </Button>
        ))}
      </div>
    )}
  </div>
);

/* ── Loading Card ── */
const LoadingCard: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <div className="flex items-center gap-2.5">
      <Loader2 className="w-4 h-4 text-accent animate-spin" />
      <span className="text-[13px] text-muted-foreground">{text}</span>
    </div>
  </div>
);

/* ── Empty State ── */
const EmptyState: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) / 0.15, hsl(var(--pivt-blue)) / 0.15)' }}
      >
        <Sparkles className="w-5 h-5 text-accent" />
      </div>
      <p className="text-sm font-medium mb-1">What would you like to do?</p>
      <p className="text-xs text-muted-foreground max-w-[240px] mb-4">
        Create a new deal, open an existing one, or ask Newton to run actions.
      </p>
      <button
        onClick={() => navigate('/demo')}
        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-accent-foreground transition-all hover:opacity-90"
        style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
      >
        <Play className="w-3.5 h-3.5" />
        See Demo
      </button>
    </div>
  );
};
