import React, { useState, useMemo } from 'react';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { navigationByMode } from '@/lib/navigation';
import {
  Plus, Moon, Sun, Send, Search, ChevronRight,
  AlertTriangle, CheckCircle2, FileText, Users, DollarSign,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onOpenChange }) => {
  const {
    setActiveSection, toggleMode, viewMode,
    deals, stakeholders, pendingApprovals, documents,
  } = usePIVTStore();
  const { openWizard } = useDealWizardStore();
  const [filter, setFilter] = useState<'all' | 'actions' | 'search'>('all');

  const nav = navigationByMode.manda;

  const navigate = (section: ActiveSection) => {
    setActiveSection(section);
    onOpenChange(false);
  };

  const suggested = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; sub: string; action: () => void }[] = [];
    // KYC flagged
    const pendingKyc = stakeholders.filter(s => s.kycStatus === 'pending');
    if (pendingKyc.length > 0) {
      items.push({
        icon: <AlertTriangle className="w-5 h-5 text-amber-500" />,
        label: `Review ${pendingKyc[0].name} KYC`,
        sub: 'Flagged by Compliance Agent',
        action: () => navigate('verification'),
      });
    }
    // Pending approvals
    if (pendingApprovals.length > 0) {
      const top = pendingApprovals[0];
      items.push({
        icon: <Send className="w-5 h-5 text-blue-500" />,
        label: top.description,
        sub: 'Ready for approval',
        action: () => navigate('approvals'),
      });
    }
    return items;
  }, [stakeholders, pendingApprovals]);

  const quickActions = [
    {
      icon: <Plus className="w-5 h-5 text-accent" />,
      label: 'New Deal',
      sub: 'Create a new deal',
      shortcut: '⌘N',
      action: () => { openWizard(); onOpenChange(false); },
    },
    {
      icon: viewMode === 'cover'
        ? <Moon className="w-5 h-5 text-purple-400" />
        : <Sun className="w-5 h-5 text-amber-400" />,
      label: viewMode === 'cover' ? 'Toggle Glass Mode' : 'Toggle Cover Mode',
      sub: viewMode === 'cover' ? 'Switch to Glass Mode' : 'Switch to Cover Mode',
      shortcut: '⌘G',
      action: () => { toggleMode(); onOpenChange(false); },
    },
    {
      icon: <Send className="w-5 h-5 text-accent" />,
      label: 'View Pending Approvals',
      sub: `${pendingApprovals.length} items waiting`,
      action: () => navigate('approvals'),
    },
  ];

  // Searchable items: nav + deals + stakeholders + documents
  const searchableItems = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; sub: string; group: string; action: () => void }[] = [];
    nav.forEach(n => {
      items.push({
        icon: <n.icon className="w-4 h-4" />,
        label: n.label,
        sub: 'Navigate',
        group: 'Pages',
        action: () => navigate(n.path as ActiveSection),
      });
    });
    deals.forEach(d => {
      items.push({
        icon: <DollarSign className="w-4 h-4" />,
        label: d.codeName,
        sub: `${d.buyerName} · $${(d.consideration / 1e9).toFixed(1)}B`,
        group: 'Deals',
        action: () => { usePIVTStore.getState().setSelectedDealId(d.id); navigate('workspace'); },
      });
    });
    stakeholders.forEach(s => {
      items.push({
        icon: <Users className="w-4 h-4" />,
        label: s.name,
        sub: s.role,
        group: 'Stakeholders',
        action: () => navigate('stakeholders'),
      });
    });
    documents.forEach(d => {
      items.push({
        icon: <FileText className="w-4 h-4" />,
        label: d.name,
        sub: d.type,
        group: 'Documents',
        action: () => navigate('documents'),
      });
    });
    return items;
  }, [nav, deals, stakeholders, documents]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search or type a command..." />

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b">
        {(['all', 'actions', 'search'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {(filter === 'all' || filter === 'actions') && suggested.length > 0 && (
          <CommandGroup heading="Suggested for you">
            {suggested.map((item, i) => (
              <CommandItem key={`sug-${i}`} onSelect={item.action} className="flex items-center gap-3 py-3">
                <span className="shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.sub}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {(filter === 'all' || filter === 'actions') && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              {quickActions.map((item, i) => (
                <CommandItem key={`qa-${i}`} onSelect={item.action} className="flex items-center gap-3 py-3">
                  <span className="shrink-0">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.sub}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-xs rounded border bg-muted text-muted-foreground font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {(filter === 'all' || filter === 'search') && (
          <>
            <CommandSeparator />
            {['Pages', 'Deals', 'Stakeholders', 'Documents'].map(group => {
              const items = searchableItems.filter(i => i.group === group);
              if (!items.length) return null;
              return (
                <CommandGroup key={group} heading={group}>
                  {items.map((item, i) => (
                    <CommandItem key={`${group}-${i}`} onSelect={item.action} className="flex items-center gap-3">
                      <span className="shrink-0 text-muted-foreground">{item.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground truncate">{item.sub}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </>
        )}
      </CommandList>

      {/* Footer */}
      <div className="flex items-center gap-4 px-3 py-2 border-t text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-muted">↑↓</kbd> Navigate</span>
        <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-muted">↵</kbd> Select</span>
        <span className="flex items-center gap-1"><kbd className="px-1 border rounded bg-muted">Tab</kbd> Switch Tab</span>
        <span className="ml-auto flex items-center gap-1"><kbd className="px-1 border rounded bg-muted">esc</kbd> Close</span>
      </div>
    </CommandDialog>
  );
};
