/**
 * PIVTCompleteUnified - Premium 3-panel SaaS layout
 * Stripe/Linear-inspired with PIVT brand identity
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { springConfig } from '@/lib/animations';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { groupedNavigationByMode } from '@/lib/navigation';
import { Search, ChevronLeft, ChevronRight, Bell, Upload, Brain, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import pivtLogo from '@/assets/pivt-logo.png';
import { CommandPalette } from './CommandPalette';
import { ImportDataModal } from './ImportDataModal';
import { NotificationsDrawer } from './NotificationsDrawer';
import { useNotificationStore } from '@/stores/notificationStore';

// Cover sections
import { DealsCover } from './cover/DealsCover';
import { DealWorkspaceCover } from './cover/DealWorkspaceCover';
import { AuditCover } from './cover/AuditAndReports';
import { SettingsCover } from './cover/SettingsCover';
import { GlobalReportsCover } from './cover/GlobalReportsCover';
import { IntegrationsCover } from './cover/IntegrationsCover';
import { IntelligenceMapCover } from './cover/IntelligenceMapCover';
import { TimelineCover } from './cover/TimelineCover';
import { AIDashboardCover } from './cover/AIDashboardCover';
import { HomeCover } from './cover/HomeCover';
import { CommunicationsHub } from './cover/CommunicationsHub';
import { DealWizard } from '../deal-wizard/DealWizard';
import { NewtonDealIntelligence } from '../newton/NewtonDealIntelligence';
import { SupportPanel } from '../support/SupportPanel';
import { OntologyCover } from './cover/OntologyCover';
import { PortfolioPaymentsCover } from './cover/PortfolioPaymentsCover';
import { RiskMonitorCover } from './cover/RiskMonitorCover';

const DEAL_SCOPED_SECTIONS = new Set([
  'workspace', 'stakeholders', 'documents', 'escrow', 'approvals',
  'payments', 'ingestion', 'closing', 'verification', 'cap-table',
  'waterfall', 'kyc', 'deal-inputs', 'execution',
]);

const coverSections: Record<string, React.FC> = {
  home: HomeCover,
  deals: DealsCover,
  workspace: DealWorkspaceCover,
  reports: GlobalReportsCover,
  audit: AuditCover,
  settings: SettingsCover,
  integrations: IntegrationsCover,
  'intelligence-map': IntelligenceMapCover,
  timeline: TimelineCover,
  ai: AIDashboardCover,
  communications: CommunicationsHub,
  'portfolio-payments': PortfolioPaymentsCover,
  'risk-monitor': RiskMonitorCover,
  'ontology': OntologyCover,
};

export const PIVTCompleteUnified: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeSection, setActiveSection, selectedDealId } = usePIVTStore();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const { unreadCount, seedDemoNotifications } = useNotificationStore();
  const { signOut, user } = useAuth();

  useEffect(() => { seedDemoNotifications(); }, [seedDemoNotifications]);
  const [glassMode, setGlassMode] = React.useState(() => {
    return sessionStorage.getItem('pivt-glass-mode') === 'true';
  });
  const navGroups = groupedNavigationByMode.manda;

  const toggleGlassMode = useCallback(() => {
    document.documentElement.classList.add('theme-transitioning');
    setGlassMode(prev => {
      const next = !prev;
      sessionStorage.setItem('pivt-glass-mode', String(next));
      return next;
    });
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 350);
  }, []);

  useEffect(() => {
    if (glassMode) document.documentElement.classList.add('glass-mode');
    else document.documentElement.classList.remove('glass-mode');
  }, [glassMode]);

  useEffect(() => {
    const section = searchParams.get('section');
    if (section) setActiveSection(section as ActiveSection);
    else setActiveSection('home' as ActiveSection);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeSection !== 'home') params.set('section', activeSection);
    setSearchParams(params, { replace: true });
  }, [activeSection]);

  useEffect(() => {
    if (DEAL_SCOPED_SECTIONS.has(activeSection) && activeSection !== 'workspace') {
      if (!selectedDealId) setActiveSection('deals');
      else setActiveSection('workspace');
    }
  }, [activeSection, selectedDealId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') { e.preventDefault(); toggleGlassMode(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleGlassMode]);

  const ActiveCoverSection = coverSections[activeSection] || HomeCover;

  const initials = React.useMemo(() => {
    const name = user?.user_metadata?.full_name as string | undefined;
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex h-screen overflow-hidden pivt-ambient-bg" style={{ color: 'hsl(var(--foreground))' }}>
      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 56 : 240 }}
        transition={springConfig.standard}
        className="h-full flex flex-col shrink-0 overflow-hidden"
        style={{
          background: 'hsl(var(--sidebar-background))',
          borderRight: '1px solid hsl(var(--sidebar-border))',
        }}
      >
        {/* Logo */}
        <button
          onClick={() => setActiveSection('home' as ActiveSection)}
          className="flex flex-col items-center px-4 pt-5 pb-4 w-full cursor-pointer"
        >
          <motion.img
            src={pivtLogo}
            alt="PIVT"
            className={`${sidebarCollapsed ? 'h-7' : 'h-9'} w-auto shrink-0 transition-all duration-300`}
          />
          {!sidebarCollapsed && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground/40 mt-1 leading-tight">
              The intelligence layer behind every close.
            </motion.p>
          )}
        </button>

        <div className="mx-4 border-t border-border/30" />

        {/* Search shortcut */}
        {!sidebarCollapsed && (
          <button
            onClick={() => setCommandOpen(true)}
            className="mx-3 mt-3 mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] text-muted-foreground/60 hover:bg-muted/40 transition-colors border border-border/40"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[9px] px-1 py-0.5 rounded border bg-muted/40 font-mono">⌘K</kbd>
          </button>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.category}>
              {!sidebarCollapsed && (
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">{group.category}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isPanelItem = item.path === 'newton' || item.path === 'support';
                  const isActive = activeSection === item.path;
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (item.path === 'newton') window.dispatchEvent(new CustomEvent('pivt:open-newton'));
                            else if (item.path === 'support') window.dispatchEvent(new CustomEvent('pivt:open-support'));
                            else setActiveSection(item.path as ActiveSection);
                          }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                            isActive && !isPanelItem
                              ? 'bg-accent/8 text-foreground'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                          }`}
                          style={isActive && !isPanelItem ? { borderLeft: '2px solid hsl(var(--accent))' } : { borderLeft: '2px solid transparent' }}
                        >
                          <item.icon className={`w-[16px] h-[16px] shrink-0 ${isActive && !isPanelItem ? 'text-accent' : ''}`} style={{ color: isActive ? undefined : item.iconColor }} />
                          {!sidebarCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                        </button>
                      </TooltipTrigger>
                      {sidebarCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-border/30 space-y-1">
          {/* Glass toggle (compact) */}
          <button
            onClick={toggleGlassMode}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <div className={`w-5 h-3 rounded-full transition-colors ${glassMode ? 'bg-accent' : 'bg-muted-foreground/20'}`}>
              <div className={`w-2.5 h-2.5 rounded-full bg-card mt-[1px] transition-transform ${glassMode ? 'translate-x-[9px]' : 'translate-x-[1px]'}`} />
            </div>
            {!sidebarCollapsed && <span>Glass Mode</span>}
          </button>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-1.5 rounded-lg hover:bg-muted/30 transition-colors text-muted-foreground"
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </motion.aside>

      {/* ── Main ── */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top bar */}
        <div className="shrink-0 px-6 h-12 flex items-center gap-3 pivt-glass-nav">
          <div className="flex-1" />

          {/* Newton AI Deal Scan */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('pivt:open-newton'))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--pivt-gradient-primary)' }}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Newton AI</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Open Newton AI Deal Scan (⌘J)</TooltipContent>
          </Tooltip>

          {/* Import */}
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground text-xs">
            <Upload className="w-3.5 h-3.5" />
            {!sidebarCollapsed && <span>Import</span>}
          </button>

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setNotifOpen(true)} className="relative p-2 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground">
                <Bell className="w-4 h-4" />
                {unreadCount() > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
                    {unreadCount()}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>Notifications</TooltipContent>
          </Tooltip>

          {/* Profile */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold cursor-pointer"
            style={{
              background: 'var(--pivt-gradient-primary)',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            {initials}
          </div>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={signOut} className="p-2 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`cover-${activeSection}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className={activeSection === 'intelligence-map' ? 'p-4 w-full flex-1' : 'px-8 py-6 lg:px-10 lg:py-8 max-w-6xl mx-auto w-full'}
          >
            <ActiveCoverSection />
          </motion.div>
        </AnimatePresence>
      </main>

      <DealWizard />
      <NewtonDealIntelligence />
      <SupportPanel />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <ImportDataModal open={importOpen} onClose={() => setImportOpen(false)} />
      <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
    </TooltipProvider>
  );
};
