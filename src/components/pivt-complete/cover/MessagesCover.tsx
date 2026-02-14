import React, { useState, useMemo } from 'react';
import { Send, Paperclip, CheckCircle2, Search, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';

interface TripleSignature {
  buyerCounsel: { signed: boolean; signedBy: string | null; signedAt: string | null; firm: string };
  sellerCounsel: { signed: boolean; signedBy: string | null; signedAt: string | null; firm: string };
  thirdParty: { signed: boolean; signedBy: string | null; signedAt: string | null; firm: string; role: string };
}

const generateMockThreads = () => {
  const deals = ['Project ATLAS', 'Project BEACON', 'Project CIPHER', 'NeuralPath AI'];
  const lastMessages = ['Payment approved. Proceed with wire.', 'KYC documentation received', 'Waterfall approved by counsel', 'Document review required'];
  const senders = ['Sarah Chen', 'Michael Ross', 'Finance Team', 'Compliance'];
  const statuses = ['pending_signoff', 'in_progress', 'completed', 'action_required'] as const;

  const scenarios: TripleSignature[] = [
    { buyerCounsel: { signed: false, signedBy: null, signedAt: null, firm: 'Kirkland & Ellis' }, sellerCounsel: { signed: false, signedBy: null, signedAt: null, firm: 'Wachtell Lipton' }, thirdParty: { signed: false, signedBy: null, signedAt: null, firm: 'JPMorgan Escrow', role: 'Escrow Agent' } },
    { buyerCounsel: { signed: true, signedBy: 'Michael Ross', signedAt: 'Feb 14, 2:45 PM', firm: 'Kirkland & Ellis' }, sellerCounsel: { signed: false, signedBy: null, signedAt: null, firm: 'Wachtell Lipton' }, thirdParty: { signed: false, signedBy: null, signedAt: null, firm: 'Computershare', role: 'Paying Agent' } },
    { buyerCounsel: { signed: true, signedBy: 'Michael Ross', signedAt: 'Feb 14, 2:45 PM', firm: 'Kirkland & Ellis' }, sellerCounsel: { signed: true, signedBy: 'Sarah Chen', signedAt: 'Feb 14, 3:12 PM', firm: 'Wachtell Lipton' }, thirdParty: { signed: true, signedBy: 'James Wilson', signedAt: 'Feb 14, 4:00 PM', firm: 'BNY Mellon', role: 'Escrow Agent' } },
    { buyerCounsel: { signed: false, signedBy: null, signedAt: null, firm: 'Sullivan & Cromwell' }, sellerCounsel: { signed: true, signedBy: 'Emily Rodriguez', signedAt: 'Feb 14, 1:30 PM', firm: 'Skadden Arps' }, thirdParty: { signed: true, signedBy: 'Amanda Foster', signedAt: 'Feb 14, 2:00 PM', firm: 'Wilmington Trust', role: 'Paying Agent' } },
  ];

  return Array.from({ length: 8 }, (_, i) => ({
    id: String(i + 1),
    dealLabel: deals[i % deals.length],
    lastMessage: lastMessages[i % lastMessages.length],
    lastSender: senders[i % senders.length],
    timestamp: i === 0 ? '2h ago' : i < 4 ? `${i * 2 + 3}h ago` : `${i - 3}d ago`,
    unread: i % 4 === 0,
    status: statuses[i % statuses.length],
    dealValue: `$${(Math.random() * 4 + 1).toFixed(1)}B`,
    tripleSignature: scenarios[i % scenarios.length],
  }));
};

const generateMockMessages = (threadId: number) => {
  const senders = ['Sarah Chen', 'Finance Team', 'Michael Ross', 'Compliance', 'You'];
  const messages = [
    'Payment approved. Proceed with wire.',
    'Wire sent via JPMorgan. Reference: WR-2026-4431.',
    'Confirmed. Wire received by recipient.',
    'KYC documentation has been submitted for review.',
    'All compliance checks passed. Ready for approval.',
  ];
  return Array.from({ length: 6 + (threadId % 3) }, (_, i) => ({
    id: String(i + 1),
    sender: senders[i % senders.length],
    content: messages[i % messages.length],
    timestamp: `Feb 14, ${10 + Math.floor(i / 2)}:${String((i * 7) % 60).padStart(2, '0')} AM`,
    isCurrentUser: senders[i % senders.length] === 'You',
    linkedItem: i % 4 === 1 ? { id: `KYC-${4420 + i}`, label: `KYC for Recipient ${i}` } : null,
  }));
};

export const MessagesCover: React.FC = () => {
  const mockThreads = useMemo(() => generateMockThreads(), []);
  const [selectedThread, setSelectedThread] = useState(mockThreads[0]);
  const [currentMessages, setCurrentMessages] = useState(() => generateMockMessages(1));
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalExpanded, setApprovalExpanded] = useState(false);

  const handleThreadSelect = (thread: typeof mockThreads[0]) => {
    setSelectedThread(thread);
    setCurrentMessages(generateMockMessages(parseInt(thread.id)));
  };

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    toast.success('Message sent');
    setNewMessage('');
  };

  const handleTripleSignature = (party: 'buyer' | 'seller' | 'thirdParty') => {
    const names = { buyer: 'Buyer Counsel', seller: 'Seller Counsel', thirdParty: 'Third-Party Agent' };
    toast.success(`${names[party]} signature recorded`);
  };

  const filteredThreads = mockThreads.filter(t =>
    t.dealLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingSignoffs = mockThreads.filter(t => t.status === 'pending_signoff').length;
  const actionRequired = mockThreads.filter(t => t.status === 'action_required').length;

  const sig = selectedThread?.tripleSignature;
  const signedCount = sig ? [sig.buyerCounsel.signed, sig.sellerCounsel.signed, sig.thirdParty.signed].filter(Boolean).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Messages</h2>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {pendingSignoffs > 0 && <span>{pendingSignoffs} pending</span>}
          {actionRequired > 0 && <span>{actionRequired} action needed</span>}
        </div>
      </div>

      <div className="grid grid-cols-[320px_1fr] gap-4 h-[calc(100vh-240px)]">
        {/* Thread List */}
        <div className="border rounded-lg bg-card flex flex-col overflow-hidden">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9 text-sm bg-muted/50 border-0" />
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-1">
              {filteredThreads.map((thread) => (
                <div key={thread.id} onClick={() => handleThreadSelect(thread)} className={`px-3 py-3 cursor-pointer border-b border-border/50 transition-colors ${selectedThread.id === thread.id ? 'bg-muted' : 'hover:bg-muted/50'}`}>
                  <div className="flex items-start gap-2">
                    {thread.unread && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className={`text-sm truncate ${thread.unread ? 'font-semibold' : 'font-medium'}`}>{thread.dealLabel}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{thread.timestamp}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{thread.lastSender}: {thread.lastMessage}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{thread.dealValue}</span>
                        {thread.status === 'pending_signoff' && <span className="text-xs text-discrepancy">Pending sign-off</span>}
                        {thread.status === 'action_required' && <span className="text-xs text-blocking">Action required</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Message View */}
        <div className="border rounded-lg bg-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">{selectedThread.dealLabel}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedThread.dealValue}</p>
              </div>
            </div>
          </div>

          {/* Collapsible Approval Status */}
          {sig && (
            <Collapsible open={approvalExpanded} onOpenChange={setApprovalExpanded}>
              <CollapsibleTrigger asChild>
                <div className="px-4 py-2 border-b bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    {approvalExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm">Approval Status: {signedCount} of 3 signatures</span>
                    {signedCount < 3 ? (
                      <span className="text-xs text-muted-foreground">· Awaiting {[!sig.buyerCounsel.signed && 'Buyer', !sig.sellerCounsel.signed && 'Seller', !sig.thirdParty.signed && 'Agent'].filter(Boolean).join(', ')}</span>
                    ) : (
                      <span className="text-xs text-validated">· Fully authorized</span>
                    )}
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 py-3 border-b bg-muted/20 space-y-2">
                  {[
                    { label: 'Buyer Counsel', data: sig.buyerCounsel, party: 'buyer' as const },
                    { label: 'Seller Counsel', data: sig.sellerCounsel, party: 'seller' as const },
                    { label: sig.thirdParty.role, data: sig.thirdParty, party: 'thirdParty' as const },
                  ].map(({ label, data, party }) => (
                    <div key={party} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-3">
                        {data.signed ? <CheckCircle2 className="h-4 w-4 text-validated" /> : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />}
                        <div>
                          <span className="text-sm">{label}</span>
                          <span className="text-xs text-muted-foreground ml-2">{data.signed ? `${data.signedBy} · ${data.signedAt}` : 'Pending'}</span>
                        </div>
                      </div>
                      {!data.signed && <Button size="sm" variant="outline" onClick={() => handleTripleSignature(party)} className="h-7 text-xs">Sign</Button>}
                    </div>
                  ))}
                  {signedCount === 3 && (
                    <div className="pt-2">
                      <Button size="sm" onClick={() => toast.success('Disbursement initiated')} className="w-full h-8 text-xs bg-validated hover:bg-validated/90">Execute Disbursement</Button>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-6">
              {currentMessages.map((message) => (
                <div key={message.id}>
                  {!message.isCurrentUser ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{message.sender}</span>
                        <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                      </div>
                      <p className="text-sm text-foreground/90 leading-relaxed">{message.content}</p>
                      {message.linkedItem && (
                        <div className="mt-2 inline-flex items-center gap-2 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
                          <Paperclip className="h-3 w-3" />{message.linkedItem.id} · {message.linkedItem.label}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="pl-8">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">You</span>
                        <span className="text-xs text-muted-foreground">{message.timestamp}</span>
                      </div>
                      <div className="bg-accent/5 rounded-lg px-3 py-2">
                        <p className="text-sm text-foreground/90 leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {/* Compose */}
          <div className="p-3 border-t">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground"><Paperclip className="h-4 w-4" /></Button>
              <Input placeholder="Type a message..." value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} className="flex-1 h-9 text-sm" />
              <Button size="sm" onClick={handleSendMessage} disabled={!newMessage.trim()} className="h-9 w-9 p-0"><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
