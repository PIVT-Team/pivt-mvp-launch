/**
 * PIVTCompleteUnified - Enterprise-first layout with optional Glass Mode
 * Gradient design system: G1-G5 tokens applied throughout
 */
import React, { useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { groupedNavigationByMode } from '@/lib/navigation';
import { Search, ChevronLeft, ChevronRight, Bell, LogOut } from 'lucide-react';
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
  const { signOut } = useAuth();

  // Seed demo notifications on first load
  useEffect(() => { seedDemoNotifications(); }, [seedDemoNotifications]);
  const [glassMode, setGlassMode] = React.useState(() => {
    return sessionStorage.getItem('pivt-glass-mode') === 'true';
  });
  const navGroups = groupedNavigationByMode.manda;

  // Glass mode toggle with smooth transition
  const toggleGlassMode = useCallback(() => {
    document.documentElement.classList.add('theme-transitioning');
    setGlassMode(prev => {
      const next = !prev;
      sessionStorage.setItem('pivt-glass-mode', String(next));
      return next;
    });
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 350);
  }, []);

  // Apply glass-mode class to root
  useEffect(() => {
    if (glassMode) {
      document.documentElement.classList.add('glass-mode');
    } else {
      document.documentElement.classList.remove('glass-mode');
    }
  }, [glassMode]);

  // URL sync
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

  // Deal context locking - redirect to deals if no deal selected for scoped sections
  useEffect(() => {
    if (DEAL_SCOPED_SECTIONS.has(activeSection) && activeSection !== 'workspace') {
      if (!selectedDealId) {
        setActiveSection('deals');
      } else {
        setActiveSection('workspace');
      }
    }
  }, [activeSection, selectedDealId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandOpen(true); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') { e.preventDefault(); toggleGlassMode(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleGlassMode]);

  const ActiveCoverSection = coverSections[activeSection] || HomeCover;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex h-screen overflow-hidden pivt-ambient-bg" style={{ color: 'hsl(var(--foreground))' }}>
      {/* Sidebar — wider, workflow-driven */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 56 : 260 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="h-full flex flex-col shrink-0 overflow-hidden"
        style={{
          background: 'hsl(var(--sidebar-background))',
          borderRight: '1px solid hsl(var(--sidebar-border))',
        }}
      >
      {/* Logo — simplified, no excessive animation */}
        <button
          onClick={() => setActiveSection('home' as ActiveSection)}
          className="px-5 pt-5 pb-4 flex flex-col items-center gap-2 w-full cursor-pointer"
        >
          <img
            src={pivtLogo}
            alt="PIVT"
            className={`${sidebarCollapsed ? 'h-7' : 'h-12'} w-auto shrink-0 transition-all duration-300`}
          />
          {!sidebarCollapsed && (
            <p className="text-[11px] text-muted-foreground/50 text-center whitespace-nowrap">
              Intelligence layer for every close
            </p>
          )}
        </button>

        <div className="mx-5 mb-2 border-t" style={{ borderColor: 'hsl(var(--sidebar-border))' }} />

        {/* Nav */}
        <nav className="flex-1 px-3 py-1 space-y-5 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.category}>
              {!sidebarCollapsed && (
                <p className="pivt-section-label px-3 py-1.5">{group.category}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isPanelItem = item.path === 'newton' || item.path === 'support';
                  const isActive = activeSection === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => {
                        if (item.path === 'newton') {
                          window.dispatchEvent(new CustomEvent('pivt:open-newton'));
                        } else if (item.path === 'support') {
                          window.dispatchEvent(new CustomEvent('pivt:open-support'));
                        } else {
                          setActiveSection(item.path as ActiveSection);
                        }
                      }}
                      className={`pivt-nav-item ${isActive && !isPanelItem ? 'pivt-nav-item-active' : 'text-sidebar-foreground'}`}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" style={{ color: isActive ? undefined : item.iconColor }} />
                      {!sidebarCollapsed && <span className="flex-1 text-left truncate">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse */}
        <div className="p-3 border-t" style={{ borderColor: 'hsl(var(--sidebar-border))' }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-muted/40 transition-colors"
            style={{ color: 'hsl(var(--sidebar-foreground))' }}
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </motion.aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top bar — cleaner, less clutter */}
        <div className="shrink-0 px-8 py-3.5 flex items-center gap-4 border-b border-border">
          {/* Search */}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted/30 transition-all flex-1 max-w-sm"
          >
            <Search className="w-4 h-4 shrink-0 opacity-40" />
            <span className="flex-1 text-left">Search...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] rounded border border-border bg-muted/40 font-mono opacity-50">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* Glass Mode Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground font-medium">Glass</span>
                <button
                  onClick={toggleGlassMode}
                  className="glass-toggle"
                  data-active={glassMode}
                >
                  <span className="glass-toggle-thumb" />
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent>Toggle dark mode</TooltipContent>
          </Tooltip>

          <div className="h-5 w-px bg-border" />

          {/* Notifications */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={() => setNotifOpen(true)} className="relative p-2.5 rounded-xl hover:bg-muted/30 transition-colors text-muted-foreground">
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{
              background: 'var(--pivt-gradient-primary)',
              color: '#FFFFFF',
            }}
          >
            JW
          </div>

          {/* Logout */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={signOut}
                className="p-2.5 rounded-xl hover:bg-muted/30 transition-colors text-muted-foreground"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Logout</TooltipContent>
          </Tooltip>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={`cover-${activeSection}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={activeSection === 'intelligence-map' ? 'p-6 w-full flex-1' : 'p-8 lg:p-12 max-w-5xl mx-auto w-full'}
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
