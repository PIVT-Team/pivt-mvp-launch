import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Bot, Brain, ChevronLeft, ChevronRight, Loader2, MessageSquare, ShieldAlert, Sparkles, Zap, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useNewtonContext } from '@/contexts/NewtonContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const STORAGE_KEY = 'pivt-newton-rail-collapsed';
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton`;

type RailMessage = { role: 'user' | 'assistant'; content: string };

type ProactiveItem = {
  id: string;
  title: string;
  detail: string;
  category: 'discrepancy' | 'approval' | 'confidence' | 'benchmark';
};

async function streamNewton(
  messages: RailMessage[],
  dealContext: Record<string, unknown>,
  onDelta: (chunk: string) => void,
) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ messages, dealContext }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || `Newton request failed (${response.status})`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nextLineBreak = buffer.indexOf('\n');
    while (nextLineBreak !== -1) {
      const rawLine = buffer.slice(0, nextLineBreak).replace(/\r$/, '');
      buffer = buffer.slice(nextLineBreak + 1);

      if (rawLine.startsWith('data: ')) {
        const payload = rawLine.slice(6).trim();
        if (payload === '[DONE]') return;
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onDelta(delta);
      }

      nextLineBreak = buffer.indexOf('\n');
    }
  }
}

export const NewtonRail: React.FC = () => {
  const { user } = useAuth();
  const { metrics, realDeal, dealId } = useDealWorkspace();
  const { currentDealId, currentTab, currentRecordId, currentRecordType, railForcedOpen, clearRailForcedOpen } = useNewtonContext();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [messages, setMessages] = useState<RailMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingContext, setLoadingContext] = useState(true);
  const [discrepancies, setDiscrepancies] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [lowConfidenceFields, setLowConfidenceFields] = useState<any[]>([]);
  const [benchmarkInsight, setBenchmarkInsight] = useState<string | null>(null);

  useEffect(() => {
    if (railForcedOpen) {
      setCollapsed(false);
      localStorage.setItem(STORAGE_KEY, 'false');
      clearRailForcedOpen();
    }
  }, [railForcedOpen, clearRailForcedOpen]);

  useEffect(() => {
    const handleOpen = () => {
      setCollapsed(false);
      localStorage.setItem(STORAGE_KEY, 'false');
    };
    window.addEventListener('pivt:open-newton', handleOpen as EventListener);
    return () => window.removeEventListener('pivt:open-newton', handleOpen as EventListener);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!currentDealId) {
      setLoadingContext(false);
      return;
    }

    setLoadingContext(true);

    Promise.all([
      supabase.from('discrepancies').select('id, message, object_type, confidence_status, severity').eq('deal_id', currentDealId).eq('status', 'open').limit(6),
      supabase.from('deal_approvals').select('id, approver_email, approver_name, status, approval_type, user_id').eq('deal_id', currentDealId).eq('status', 'pending').limit(6),
      supabase.from('field_corrections').select('id').eq('deal_id', currentDealId).limit(1),
      supabase.from('entities').select('canonical_name, metadata').eq('source_deal_id', currentDealId).limit(1),
      supabase.from('contract_documents').select('id, filename, extraction_confidence, document_role').eq('deal_id', currentDealId).lt('extraction_confidence', 0.7).limit(6),
    ]).then(([discRes, approvalRes, _correctionRes, entityRes, confidenceDocs]) => {
      setDiscrepancies(discRes.data ?? []);
      setApprovals((approvalRes.data ?? []).filter((item: any) => !user?.id || item.user_id === user.id || item.approver_email === user.email));
      setLowConfidenceFields(confidenceDocs.data ?? []);

      const firstEntity = entityRes.data?.[0];
      setBenchmarkInsight(firstEntity ? `Cross-deal benchmark: ${firstEntity.canonical_name} appears in the shared entity graph, enabling comparable counterparty pattern checks.` : null);
      setLoadingContext(false);
    });
  }, [currentDealId, user?.email, user?.id]);

  const proactiveItems = useMemo<ProactiveItem[]>(() => {
    const items: ProactiveItem[] = [];

    discrepancies
      .filter((item: any) => currentTab === 'compliance' || currentTab === 'verification' || item.object_type?.toLowerCase().includes(currentTab.replace('-', '_')))
      .slice(0, 3)
      .forEach((item: any) => items.push({
        id: `disc-${item.id}`,
        title: item.message,
        detail: `${item.severity} discrepancy in ${item.object_type || 'current view'}`,
        category: 'discrepancy',
      }));

    approvals.slice(0, 2).forEach((item: any) => items.push({
      id: `approval-${item.id}`,
      title: item.approval_type || 'Approval pending',
      detail: `Awaiting your action${item.approver_name ? ` — ${item.approver_name}` : ''}`,
      category: 'approval',
    }));

    lowConfidenceFields.slice(0, 3).forEach((item: any) => items.push({
      id: `confidence-${item.id}`,
      title: item.filename,
      detail: `Extraction confidence ${(Number(item.extraction_confidence || 0) * 100).toFixed(0)}% in ${currentTab}`,
      category: 'confidence',
    }));

    if (benchmarkInsight) {
      items.push({
        id: 'benchmark',
        title: 'Cross-deal benchmark',
        detail: benchmarkInsight,
        category: 'benchmark',
      });
    }

    return items;
  }, [approvals, benchmarkInsight, currentTab, discrepancies, lowConfidenceFields]);

  const dealContext = useMemo(() => ({
    deal: realDeal ? {
      id: currentDealId || dealId,
      name: realDeal.deal_name,
      number: realDeal.deal_number,
      state: realDeal.deal_state,
      status: realDeal.status,
      value: realDeal.deal_value,
      closing_date: realDeal.closing_date,
    } : null,
    workspace: {
      currentTab,
      currentRecordId,
      currentRecordType,
    },
    summary: metrics ? {
      readiness_percent: metrics.readinessPercent,
      pending_approvals: metrics.totalApprovals - metrics.grantedApprovals,
      unresolved_discrepancies: metrics.openDiscrepancies,
      low_confidence_fields: lowConfidenceFields.length,
    } : null,
  }), [currentDealId, currentRecordId, currentRecordType, currentTab, dealId, lowConfidenceFields.length, metrics, realDeal]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || sending) return;
    const nextMessages = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    let assistantText = '';
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

    try {
      await streamNewton(nextMessages, dealContext, (chunk) => {
        assistantText += chunk;
        setMessages((prev) => prev.map((message, index) => index === prev.length - 1 ? { ...message, content: assistantText } : message));
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Newton request failed');
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  }, [dealContext, input, messages, sending]);

  const exportContext = useCallback(() => {
    const payload = {
      exported_at: new Date().toISOString(),
      deal_context: dealContext,
      proactive_items: proactiveItems,
      conversation: messages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `newton-context-${currentDealId || 'workspace'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [currentDealId, dealContext, messages, proactiveItems]);

  return (
    <aside className={cn('shrink-0 border-l border-border/50 bg-card/95 backdrop-blur-sm transition-all duration-300', collapsed ? 'w-12' : 'w-80')}>
      <div className="flex h-full min-h-[600px] flex-col">
        <div className="flex items-center justify-between border-b border-border/50 px-3 py-3">
          {collapsed ? (
            <button onClick={toggleCollapsed} className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground">
              <Bot className="h-4 w-4" />
            </button>
          ) : (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Newton</p>
                    <p className="text-[11px] text-muted-foreground">Persistent deal copilot</p>
                  </div>
                </div>
              </div>

              <button onClick={toggleCollapsed} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/50 hover:text-foreground">
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {!collapsed && (
          <>
            <div className="border-b border-border/50 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="gap-1.5 text-[10px]">
                  <Brain className="h-3 w-3" />
                  {currentTab}
                </Badge>
                <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={exportContext}>
                  <Download className="h-3 w-3" />
                  Export
                </Button>
              </div>
              {currentRecordType && currentRecordId ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Focused on {currentRecordType} <span className="font-mono">{currentRecordId.slice(0, 8)}</span></p>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">Context follows the current workspace view automatically.</p>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-5 px-4 py-4">
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Brain className="h-4 w-4 text-accent" />
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Context</h2>
                  </div>

                  {loadingContext ? (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading contextual signals…
                    </div>
                  ) : proactiveItems.length === 0 ? (
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
                      Newton will surface discrepancies, approvals, low-confidence fields, and benchmarks here.
                    </div>
                  ) : (
                    proactiveItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 text-accent">
                            {item.category === 'discrepancy' && <ShieldAlert className="h-4 w-4" />}
                            {item.category === 'approval' && <Zap className="h-4 w-4" />}
                            {item.category === 'confidence' && <Sparkles className="h-4 w-4" />}
                            {item.category === 'benchmark' && <Brain className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </section>

                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Chat</h2>
                  </div>

                  <div className="space-y-2 rounded-lg border border-border/50 bg-background/60 p-3">
                    {messages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Ask Newton about the current tab, focused record, or next action for this deal.</p>
                    ) : (
                      messages.map((message, index) => (
                        <div key={`${message.role}-${index}`} className={cn('rounded-lg px-3 py-2 text-sm', message.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-muted/40 text-foreground')}>
                          {message.role === 'assistant' ? <ReactMarkdown>{message.content}</ReactMarkdown> : message.content}
                        </div>
                      ))
                    )}
                    {sending && <div className="text-xs text-muted-foreground">Newton is responding…</div>}
                  </div>

                  <div className="space-y-2">
                    <Textarea
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      placeholder="Ask Newton about this view…"
                      className="min-h-[84px] resize-none"
                    />
                    <Button className="w-full" onClick={sendMessage} disabled={sending || !input.trim()}>
                      {sending ? <Loader2 className="animate-spin" /> : <MessageSquare />}
                      Send to Newton
                    </Button>
                  </div>
                </section>

                <section className="space-y-3 pb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-accent" />
                    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Actions</h2>
                  </div>
                  <div className="space-y-2">
                    {[
                      ...discrepancies.slice(0, 2).map((item: any) => ({ id: item.id, label: item.message, meta: 'Open discrepancy' })),
                      ...approvals.slice(0, 2).map((item: any) => ({ id: item.id, label: item.approval_type || 'Approval pending', meta: 'Needs approval action' })),
                      ...lowConfidenceFields.slice(0, 2).map((item: any) => ({ id: item.id, label: item.filename, meta: 'Low confidence extraction' })),
                    ].map((item) => (
                      <div key={item.id} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.meta}</p>
                      </div>
                    ))}
                    {!discrepancies.length && !approvals.length && !lowConfidenceFields.length && (
                      <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        No pending Newton-tracked items on this deal right now.
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>
          </>
        )}

        {collapsed && (
          <div className="flex flex-1 flex-col items-center gap-3 py-4 text-muted-foreground">
            <button onClick={toggleCollapsed} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted/50 hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Brain className="h-4 w-4" />
            <MessageSquare className="h-4 w-4" />
            <Zap className="h-4 w-4" />
          </div>
        )}
      </div>
    </aside>
  );
};