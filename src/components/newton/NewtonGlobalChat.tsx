/**
 * Newton Global Chat - AI Operating Layer for PIVT
 * Floating chat button + panel with real action execution
 * Available on any page via ⌘J keyboard shortcut
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { springConfig } from '@/lib/animations';
import {
  Sparkles, Send, Loader2, X, Minus, CheckCircle2, AlertTriangle, Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import pivtLogo from '@/assets/pivt-logo.png';
import { NewtonCreateDealForm } from './NewtonCreateDealForm';
import {
  detectIntent,
  executeCreateDeal,
  executeSummarizeReadiness,
  executeListBlockers,
  executeGenerateKycRequests,
  executePrepareApprovalPackage,
  executeListDeals,
  SUPPORTED_ACTIONS_TEXT,
  type NewtonIntent,
  type NewtonActionResult,
} from '@/services/newtonActionService';

type MsgRole = 'user' | 'assistant' | 'action_result' | 'action_form';

interface Msg {
  role: MsgRole;
  content: string;
  actionType?: string;
  actionResult?: NewtonActionResult;
  formType?: string;
}

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
  const { activeSection, setActiveSection } = usePIVTStore();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
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

  const handleActionExecution = useCallback(async (intent: NewtonIntent, userText: string) => {
    // If action requires a form, show it
    if (intent.requiresForm && intent.formType === 'create_deal') {
      setMessages(prev => [...prev,
        { role: 'assistant', content: "I'll help you create a new deal. Please fill in the details below:" },
        { role: 'action_form' as MsgRole, content: '', formType: 'create_deal' },
      ]);
      return true;
    }

    // Execute direct actions
    setActionLoading(true);
    let result: NewtonActionResult;

    try {
      const selectedDealId = usePIVTStore.getState().selectedDealId;

      switch (intent.action) {
        case 'summarize_readiness':
          if (!selectedDealId) {
            result = { success: false, message: 'No deal selected. Please select a deal first or navigate to a deal workspace.' };
          } else {
            result = await executeSummarizeReadiness(selectedDealId);
          }
          break;
        case 'list_blockers':
          if (!selectedDealId) {
            result = { success: false, message: 'No deal selected. Please select a deal first.' };
          } else {
            result = await executeListBlockers(selectedDealId);
          }
          break;
        case 'generate_kyc_requests':
        case 'generate_kyb_requests':
          if (!selectedDealId) {
            result = { success: false, message: 'No deal selected. Please select a deal first.' };
          } else {
            result = await executeGenerateKycRequests(selectedDealId, user?.id);
          }
          break;
        case 'prepare_approval_package':
          if (!selectedDealId) {
            result = { success: false, message: 'No deal selected. Please select a deal first.' };
          } else {
            result = await executePrepareApprovalPackage(selectedDealId, user?.id);
          }
          break;
        case 'list_deals':
          result = await executeListDeals(user?.id);
          break;
        default:
          result = { success: false, message: SUPPORTED_ACTIONS_TEXT };
      }
    } catch (e) {
      result = { success: false, message: `Action failed: ${e instanceof Error ? e.message : 'Unknown error'}` };
    }

    setActionLoading(false);
    setMessages(prev => [...prev, {
      role: 'action_result' as MsgRole,
      content: result.message,
      actionType: intent.action,
      actionResult: result,
    }]);

    if (result.navigateTo) {
      setActiveSection(result.navigateTo as any);
    }

    return true;
  }, [user, setActiveSection]);

  const handleCreateDealSubmit = useCallback(async (data: any) => {
    setActionLoading(true);

    // Remove the form message
    setMessages(prev => prev.filter(m => m.role !== 'action_form'));

    const result = await executeCreateDeal(data, user?.id);
    setActionLoading(false);

    setMessages(prev => [...prev, {
      role: 'action_result' as MsgRole,
      content: result.message,
      actionType: 'create_deal',
      actionResult: result,
    }]);

    if (result.navigateTo) {
      setActiveSection(result.navigateTo as any);
    }
  }, [user, setActiveSection]);

  const handleCancelForm = useCallback(() => {
    setMessages(prev => prev.filter(m => m.role !== 'action_form'));
    setMessages(prev => [...prev, { role: 'assistant', content: 'No problem. Let me know if you need anything else.' }]);
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || isLoading || actionLoading) return;
    const userMsg: Msg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');

    // Detect intent
    const intent = detectIntent(text);

    if (intent.action !== 'unsupported' && intent.confidence > 0.5) {
      setIsLoading(true);
      const handled = await handleActionExecution(intent, text);
      setIsLoading(false);
      if (handled) return;
    }

    // Fall through to AI chat for conversational queries
    setIsLoading(true);
    const all = [...messages, userMsg];
    const ctx = `[Deal: ${deal.codeName} | $${(deal.consideration / 1e6).toFixed(1)}M | ${deal.status} | View: ${activeSection}]\n\n`;
    const apiMsgs = all
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map((m, i) => i === 0 && m.role === 'user' ? { ...m, content: ctx + m.content } : { role: m.role, content: m.content });

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

  const renderMessage = (msg: Msg, i: number) => {
    if (msg.role === 'action_form' && msg.formType === 'create_deal') {
      return (
        <div key={i} className="px-1">
          <NewtonCreateDealForm
            onSubmit={handleCreateDealSubmit}
            isLoading={actionLoading}
            onCancel={handleCancelForm}
          />
        </div>
      );
    }

    if (msg.role === 'action_result') {
      const success = msg.actionResult?.success ?? true;
      return (
        <div key={i} className="flex justify-start">
          <div className={cn(
            'px-3 py-2 rounded-xl max-w-[90%] text-sm border',
            success
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-destructive/10 border-destructive/30'
          )}>
            <div className="flex items-center gap-1.5 mb-1">
              {success
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                : <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {success ? 'Action Completed' : 'Action Failed'}
              </span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_code]:text-xs [&_table]:text-xs">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      );
    }

    return (
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
    );
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  onClick={() => { setIsOpen(true); setIsMinimized(false); }}
                  className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}
                >
                  <Sparkles className="w-6 h-6 text-white" />
                </motion.button>
              </TooltipTrigger>
              <TooltipContent side="left" className="bg-yellow-400 text-black text-xs font-medium border-0">
                Ask the Newton Chatbot
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
              height: isMinimized ? 56 : 560,
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={springConfig.standard}
            className="fixed bottom-6 right-6 z-50 w-[420px] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30 shrink-0">
              <img src={pivtLogo} alt="Newton" className="w-6 h-6" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Newton</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {deal.codeName} · AI Copilot · Actions Enabled
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
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <div className="text-center py-6 space-y-3">
                      <Sparkles className="w-6 h-6 text-accent mx-auto opacity-50" />
                      <p className="text-xs text-muted-foreground">Newton can execute real actions on your deals.</p>
                      <div className="text-[11px] text-muted-foreground text-left bg-muted/30 rounded-lg p-3 space-y-1">
                        <p className="font-medium text-foreground mb-1.5">Try saying:</p>
                        {[
                          '"Create a new deal"',
                          '"What\'s blocking this deal?"',
                          '"Summarize closing readiness"',
                          '"Generate KYC requests"',
                          '"Prepare approval package"',
                        ].map((s, i) => (
                          <button
                            key={i}
                            onClick={() => { setInput(s.replace(/"/g, '')); }}
                            className="block w-full text-left px-2 py-1 rounded hover:bg-muted/60 transition-colors cursor-pointer"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((msg, i) => renderMessage(msg, i))}
                  {(isLoading || actionLoading) && messages[messages.length - 1]?.role !== 'assistant' && messages[messages.length - 1]?.role !== 'action_form' && (
                    <div className="flex justify-start">
                      <div className="px-3 py-2 rounded-xl bg-muted/50 border border-border flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-accent" />
                        <span className="text-xs text-muted-foreground">
                          {actionLoading ? 'Executing action...' : 'Thinking...'}
                        </span>
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
                    placeholder="Ask Newton to act..."
                    className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                    disabled={isLoading || actionLoading}
                  />
                  <Button type="submit" size="icon" className="h-7 w-7 shrink-0" disabled={!input.trim() || isLoading || actionLoading}>
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
