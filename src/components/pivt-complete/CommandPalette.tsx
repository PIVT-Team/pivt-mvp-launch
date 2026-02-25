import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { navigationByMode } from '@/lib/navigation';
import {
  Plus, Moon, Sun, Send, Search, ChevronRight, Sparkles,
  AlertTriangle, FileText, Users, DollarSign, Shield, Scale,
  Clock, Loader2, Filter, type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SearchResult {
  category: string;
  id: string;
  title: string;
  subtitle: string;
  snippet?: string;
  deepLink: string;
  matchField?: string;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Deals': DollarSign,
  'Stakeholders': Users,
  'Documents': FileText,
  'KYC / Compliance': Shield,
  'Payments': DollarSign,
  'Approvals': Scale,
  'Audit Log': Clock,
  'Discrepancies': AlertTriangle,
  'Pages': Search,
};

const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'deals', label: 'Deals' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'documents', label: 'Documents' },
  { id: 'kyc', label: 'KYC' },
  { id: 'payments', label: 'Payments' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'audit', label: 'Audit' },
  { id: 'discrepancies', label: 'Discrepancies' },
];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/25 text-foreground rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const {
    setActiveSection, toggleMode, viewMode,
    deals, stakeholders, pendingApprovals, documents,
  } = usePIVTStore();
  const { openWizard } = useDealWizardStore();

  const [tab, setTab] = useState<'all' | 'actions' | 'search'>('all');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [dbResults, setDbResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isQuestion, setIsQuestion] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setDbResults([]);
      setFilter('all');
      setTab('all');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = (section: ActiveSection) => {
    setActiveSection(section);
    onOpenChange(false);
  };

  // Debounced search
  const searchBackend = useCallback((q: string, f: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) {
      setDbResults([]);
      setIsQuestion(false);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('global-search', {
          body: { query: q, filter: f === 'all' ? undefined : f, mode: 'search' },
        });
        if (error) throw error;
        setDbResults(data?.results || []);
        setIsQuestion(data?.isQuestion || false);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 250);
  }, []);

  useEffect(() => {
    if (tab === 'search' || (tab === 'all' && query.length >= 2)) {
      searchBackend(query, filter);
    }
  }, [query, filter, tab, searchBackend]);

  const nav = navigationByMode.manda;

  // Local fuzzy search for store data
  const localResults = useMemo(() => {
    if (query.length < 2) return [];
    const lq = query.toLowerCase();
    const results: SearchResult[] = [];

    // Deals from store
    deals.forEach(d => {
      if (d.codeName.toLowerCase().includes(lq) || d.buyerName.toLowerCase().includes(lq) || d.targetCompany.toLowerCase().includes(lq)) {
        results.push({
          category: 'Deals',
          id: d.id,
          title: d.codeName,
          subtitle: `${d.buyerName} · $${(d.consideration / 1e9).toFixed(1)}B`,
          deepLink: 'workspace',
        });
      }
    });

    // Stakeholders from store
    stakeholders.forEach(s => {
      if (s.name.toLowerCase().includes(lq) || s.role.toLowerCase().includes(lq) || s.email.toLowerCase().includes(lq)) {
        results.push({
          category: 'Stakeholders',
          id: s.id,
          title: s.name,
          subtitle: `${s.role} · ${s.ownershipPct}% · ${s.kycStatus}`,
          deepLink: 'stakeholders',
        });
      }
    });

    // Documents from store
    documents.forEach(d => {
      if (d.name.toLowerCase().includes(lq) || d.type.toLowerCase().includes(lq)) {
        results.push({
          category: 'Documents',
          id: d.id,
          title: d.name,
          subtitle: `${d.type} · ${d.status}`,
          deepLink: 'documents',
        });
      }
    });

    // Nav pages
    nav.forEach(n => {
      if (n.label.toLowerCase().includes(lq)) {
        results.push({
          category: 'Pages',
          id: n.path,
          title: n.label,
          subtitle: 'Navigate',
          deepLink: n.path,
        });
      }
    });

    return results;
  }, [query, deals, stakeholders, documents, nav]);

  // Merge local + backend results, deduplicate by id
  const mergedResults = useMemo(() => {
    const seen = new Set<string>();
    const all: SearchResult[] = [];
    // DB results first (more authoritative)
    [...dbResults, ...localResults].forEach(r => {
      const key = `${r.category}-${r.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(r);
      }
    });
    return all;
  }, [dbResults, localResults]);

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, SearchResult[]> = {};
    mergedResults.forEach(r => {
      if (!map[r.category]) map[r.category] = [];
      map[r.category].push(r);
    });
    return map;
  }, [mergedResults]);

  const handleResultClick = (result: SearchResult) => {
    if (result.category === 'Deals') {
      usePIVTStore.getState().setSelectedDealId(result.id);
    }
    navigate(result.deepLink as ActiveSection);
  };

  const handleAskNewton = () => {
    onOpenChange(false);
    // Trigger Newton with ⌘J after a short delay
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('pivt:open-newton', { detail: { query } }));
    }, 100);
  };

  // Quick actions
  const quickActions = [
    {
      icon: <Plus className="w-4 h-4 text-accent" />,
      label: 'New Deal',
      sub: 'Create a new deal',
      shortcut: '⌘N',
      action: () => { openWizard(); onOpenChange(false); },
    },
    {
      icon: viewMode === 'cover'
        ? <Moon className="w-4 h-4" style={{ color: 'hsl(var(--pivt-purple))' }} />
        : <Sun className="w-4 h-4" style={{ color: 'hsl(var(--pivt-amber))' }} />,
      label: viewMode === 'cover' ? 'Toggle Glass Mode' : 'Toggle Cover Mode',
      sub: 'Switch visual theme',
      shortcut: '⌘G',
      action: () => { toggleMode(); onOpenChange(false); },
    },
    {
      icon: <Send className="w-4 h-4 text-accent" />,
      label: 'View Pending Approvals',
      sub: `${pendingApprovals.length} items waiting`,
      action: () => navigate('approvals'),
    },
  ];

  // Suggested
  const suggested = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; sub: string; action: () => void }[] = [];
    const pendingKyc = stakeholders.filter(s => s.kycStatus === 'pending');
    if (pendingKyc.length > 0) {
      items.push({
        icon: <AlertTriangle className="w-4 h-4" style={{ color: 'hsl(var(--pivt-amber))' }} />,
        label: `Review ${pendingKyc[0].name} KYC`,
        sub: 'Flagged by Compliance Agent',
        action: () => navigate('verification'),
      });
    }
    if (pendingApprovals.length > 0) {
      items.push({
        icon: <Send className="w-4 h-4" style={{ color: 'hsl(var(--pivt-blue))' }} />,
        label: pendingApprovals[0].description,
        sub: 'Ready for approval',
        action: () => navigate('approvals'),
      });
    }
    return items;
  }, [stakeholders, pendingApprovals]);

  const hasQuery = query.length >= 2;
  const showSearch = hasQuery && (tab === 'all' || tab === 'search');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl overflow-hidden border" style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals, stakeholders, documents, or ask a question..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {isSearching && <Loader2 className="w-4 h-4 animate-spin text-accent shrink-0" />}
          <kbd className="px-1.5 py-0.5 text-[10px] rounded border font-mono text-muted-foreground" style={{ borderColor: 'hsl(var(--border))' }}>
            ESC
          </kbd>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-3 py-2 border-b" style={{ borderColor: 'hsl(var(--border))' }}>
          {(['all', 'actions', 'search'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                tab === t
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Entity filter (only in search mode) */}
          {(tab === 'search' || (tab === 'all' && hasQuery)) && (
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-muted-foreground mr-1" />
              {FILTER_OPTIONS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    filter === f.id
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[420px]">
          <div className="py-1">

            {/* Ask Newton option for questions */}
            {showSearch && isQuestion && (
              <div className="px-3 py-2">
                <button
                  onClick={handleAskNewton}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:border-accent/30 hover:bg-accent/5"
                  style={{ borderColor: 'hsl(var(--border))' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'hsl(var(--accent) / 0.12)' }}>
                    <Sparkles className="w-4 h-4" style={{ color: 'hsl(var(--accent))' }} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium">Ask Newton to analyze this</p>
                    <p className="text-xs text-muted-foreground truncate">"{query}"</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}

            {/* Loading shimmer */}
            {showSearch && isSearching && mergedResults.length === 0 && (
              <div className="px-4 py-3 space-y-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-lg bg-muted" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-2/3 bg-muted rounded" />
                      <div className="h-2.5 w-1/3 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Grouped search results */}
            {showSearch && !isSearching && mergedResults.length > 0 && (
              <div className="px-1">
                <div className="px-3 py-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {mergedResults.length} result{mergedResults.length !== 1 ? 's' : ''} for "{query}"
                  </p>
                </div>
                {Object.entries(grouped).map(([category, items]) => {
                  const Icon = CATEGORY_ICONS[category] || Search;
                  return (
                    <div key={category} className="mb-1">
                      <div className="flex items-center gap-2 px-3 py-1.5">
                        <Icon className="w-3 h-3 text-muted-foreground" />
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                          {category} ({items.length})
                        </p>
                      </div>
                      {items.map(result => (
                        <button
                          key={`${result.category}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-lg mx-1"
                          style={{ width: 'calc(100% - 8px)' }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {highlightMatch(result.title, query)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                            {result.snippet && (
                              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic">
                                {highlightMatch(result.snippet, query)}
                              </p>
                            )}
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}

            {/* No results */}
            {showSearch && !isSearching && mergedResults.length === 0 && !isQuestion && query.length >= 2 && (
              <div className="px-4 py-8 text-center">
                <Search className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">No results for "{query}"</p>
                <button
                  onClick={handleAskNewton}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline"
                >
                  <Sparkles className="w-3 h-3" />
                  Ask Newton instead
                </button>
              </div>
            )}

            {/* Actions + Suggested (when no query or in actions tab) */}
            {(!hasQuery || tab === 'actions') && (
              <>
                {suggested.length > 0 && (tab === 'all' || tab === 'actions') && (
                  <div className="px-1 py-1">
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Suggested for you</p>
                    </div>
                    {suggested.map((item, i) => (
                      <button
                        key={`sug-${i}`}
                        onClick={item.action}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-lg mx-1"
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.sub}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                )}

                {(tab === 'all' || tab === 'actions') && (
                  <div className="px-1 py-1">
                    <div className="px-3 py-1.5">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Quick Actions</p>
                    </div>
                    {quickActions.map((item, i) => (
                      <button
                        key={`qa-${i}`}
                        onClick={item.action}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/50 transition-colors rounded-lg mx-1"
                        style={{ width: 'calc(100% - 8px)' }}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.sub}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.shortcut && (
                            <kbd className="px-1.5 py-0.5 text-[10px] rounded border font-mono text-muted-foreground" style={{ borderColor: 'hsl(var(--border))' }}>
                              {item.shortcut}
                            </kbd>
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center gap-4 px-3 py-2 border-t text-[10px] text-muted-foreground" style={{ borderColor: 'hsl(var(--border))' }}>
          <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-muted" style={{ borderColor: 'hsl(var(--border))' }}>↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-muted" style={{ borderColor: 'hsl(var(--border))' }}>↵</kbd> Select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-muted" style={{ borderColor: 'hsl(var(--border))' }}>Tab</kbd> Switch</span>
          <span className="ml-auto flex items-center gap-1">
            <Sparkles className="w-3 h-3" style={{ color: 'hsl(var(--accent))' }} />
            AI-powered
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
};
