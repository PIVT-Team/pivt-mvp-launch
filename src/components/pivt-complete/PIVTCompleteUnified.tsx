/**
 * PIVTCompleteUnified - Premium 3-panel SaaS layout
 * Stripe/Linear-inspired with PIVT brand identity
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React, { useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { springConfig } from '@/lib/animations';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { groupedNavigationByMode } from '@/lib/navigation';
import { Search, ChevronLeft, ChevronRight, Bell, Upload, Brain, LogOut, Play, Settings as SettingsIcon, User as UserIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import pivtLogo from '@/assets/pivt-logo.png';
import { CommandPalette } from './CommandPalette';
import { ImportDataModal } from './ImportDataModal';
import { NotificationsDrawer } from './NotificationsDrawer';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { OrgSwitcher } from './OrgSwitcher';
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
import { IntelligenceDashboardCover } from './cover/IntelligenceDashboardCover';
import { DealWizard } from '../deal-wizard/DealWizard';
import { NewtonDealIntelligence } from '../newton/NewtonDealIntelligence';
import { SupportPanel } from '../support/SupportPanel';
import { OntologyCover } from './cover/OntologyCover';
import { PortfolioPaymentsCover } from './cover/PortfolioPaymentsCover';
import { RiskMonitorCover } from './cover/RiskMonitorCover';
import { RiskMonitorStrip } from './RiskMonitorStrip';
import { DealContextBar } from './DealContextBar';

// Deal-scoped sections that historically only render *inside* the workspace.
// If user navigates here without a workspace context, we redirect to deals/workspace.
const DEAL_SCOPED_SECTIONS = new Set([
  'workspace', 'stakeholders', 'documents', 'escrow', 'approvals',
  'payments', 'ingestion', 'verification', 'cap-table',
  'waterfall', 'kyc', 'deal-inputs', 'execution',
]);

// Deal-AWARE sections render in place at the top-level but operate on the
// currently selected deal. They show the persistent DealContextBar above
// their own content and surface their own "Select a deal" empty state when
// no deal is selected.
const DEAL_AWARE_SECTIONS = new Set([
  'timeline', 'communications', 'intelligence',
  'intelligence-map', 'workspace',
]);

const coverSections: Record<string, React.FC> = {
  home: HomeCover,
  deals: DealsCover,
  intelligence: IntelligenceDashboardCover,
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
  const { activeSection, setActiveSection, selectedDealId, setSelectedDealId } = usePIVTStore();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const { unreadCount, seedDemoNotifications } = useNotificationStore();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => { seedDemoNotifications(); }, [seedDemoNotifications]);

  // ── Onboarding wizard: auto-open for first-run users + listen for a
  //    manual "restart onboarding" event the Account tab dispatches. ──
  const [onboardingOpen, setOnboardingOpen] = React.useState(false);
  useEffect(() => {
    // Auto-open on first sign-in for any user who hasn't completed onboarding.
    // user.user_metadata is the source of truth — set when the wizard's
    // completeOnboarding writes to auth.users.raw_user_meta_data.
    if (!user) return;
    const completed = (user.user_metadata as any)?.onboarding_complete === true;
    if (!completed) {
      // Small delay so the app has time to render the workspace shell first —
      // the wizard then layers on top, less jarring than appearing instantly.
      const t = setTimeout(() => setOnboardingOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [user?.id, (user?.user_metadata as any)?.onboarding_complete]);

  useEffect(() => {
    // Manual re-open via Account → "Restart onboarding".
    const handler = () => setOnboardingOpen(true);
    window.addEventListener('pivt:open-onboarding', handler);
    return () => window.removeEventListener('pivt:open-onboarding', handler);
  }, []);
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
    const dealId = searchParams.get('dealId');

    if (section) setActiveSection(section as ActiveSection);
    else setActiveSection('home' as ActiveSection);

    if (dealId && dealId !== usePIVTStore.getState().selectedDealId) {
      setSelectedDealId(dealId);
    }
  }, [searchParams, setActiveSection, setSelectedDealId]);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (activeSection !== 'home') params.set('section', activeSection);
    else params.delete('section');
    if (selectedDealId) params.set('dealId', selectedDealId);
    else params.delete('dealId');
    setSearchParams(params, { replace: true });
  }, [activeSection, searchParams, selectedDealId, setSearchParams]);

  useEffect(() => {
    if (DEAL_SCOPED_SECTIONS.has(activeSection) && activeSection !== 'workspace') {
      if (!selectedDealId) setActiveSection('deals');
      else setActiveSection('workspace');
    }
  }, [activeSection, selectedDealId]);

  useEffect(() => {
    if (activeSection !== 'ai') return;

    window.dispatchEvent(new CustomEvent('pivt:open-newton'));
    if (selectedDealId) setActiveSection('workspace');
  }, [activeSection, selectedDealId, setActiveSection]);

  const handleOpenNewton = useCallback(() => {
    window.dispatchEvent(new CustomEvent('pivt:open-newton'));
    if (selectedDealId && activeSection !== 'workspace') {
      setActiveSection('workspace');
    }
  }, [activeSection, selectedDealId, setActiveSection]);

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
              The payments execution layer for M&A.
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
                  const isPanelItem = item.path === 'newton' || item.path === 'support' || item.path === 'ai';
                  const isActive = activeSection === item.path;
                  return (
                    <Tooltip key={item.path}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            if (item.path === 'newton' || item.path === 'ai') handleOpenNewton();
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
          {/* Org switcher — leftmost so it reads as the "context for everything
              below" anchor. Falls back gracefully if the multi-tenancy schema
              hasn't been deployed (shows a "setup needed" pill instead). */}
          <OrgSwitcher />
          <div className="flex-1" />

          {/* Newton AI Deal Scan */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleOpenNewton}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all hover:opacity-90"
                style={{ background: 'var(--pivt-gradient-primary)' }}
              >
                <Brain className="w-3.5 h-3.5" />
                <span>AI Deal Scan</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Open Newton AI Deal Scan (⌘J)</TooltipContent>
          </Tooltip>

          {/* See Demo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/demo')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-foreground transition-all hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
              >
                <Play className="w-3.5 h-3.5" />
                <span>See Demo</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Watch the cinematic PIVT demo</TooltipContent>
          </Tooltip>

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

          {/* Profile dropdown — Settings + Sign out */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Open account menu"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold cursor-pointer hover:ring-2 hover:ring-accent/30 transition-shadow"
                style={{
                  background: 'var(--pivt-gradient-primary)',
                  color: '#FFFFFF',
                  letterSpacing: '-0.02em',
                }}
              >
                {initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold leading-tight">Signed in as</span>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[180px]">{user?.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveSection('settings' as ActiveSection)} className="gap-2 cursor-pointer">
                <SettingsIcon className="w-3.5 h-3.5" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <RiskMonitorStrip />

        {/* Persistent deal selector — visible above any deal-aware top-level
            section so users can switch deal context without leaving the page.
            Hidden inside the dedicated workspace cover (which has its own
            ATLAS-style deal header) to avoid duplication. */}
        {DEAL_AWARE_SECTIONS.has(activeSection) && activeSection !== 'workspace' && (
          <DealContextBar />
        )}

        <motion.div
          key={`cover-${activeSection}-${DEAL_AWARE_SECTIONS.has(activeSection) ? selectedDealId || 'none' : 'global'}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className={
            activeSection === 'intelligence-map'
              ? 'p-4 w-full flex-1'
              : 'px-8 py-6 lg:px-10 lg:py-8 max-w-6xl mx-auto w-full'
          }
        >
          <ActiveCoverSection />
        </motion.div>

        {/* Footer */}
        <footer className="shrink-0 px-8 py-4 border-t border-border/30 text-[11px] text-muted-foreground/50">
          <div className="flex items-center justify-between flex-wrap gap-y-2">
            <span>© {new Date().getFullYear()} PIVT, Inc.</span>
            <div className="flex items-center gap-3 flex-wrap">
              <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <span>·</span>
              <Link to="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
              <span>·</span>
              <Link to="/dpa" className="hover:text-foreground transition-colors">DPA</Link>
              <span>·</span>
              <Link to="/cookie-policy" className="hover:text-foreground transition-colors">Cookie Policy</Link>
              <span>·</span>
              <Link to="/security" className="hover:text-foreground transition-colors">Data Security</Link>
              <span>·</span>
              <Link to="/contact" className="hover:text-foreground transition-colors">Contact & Support</Link>
              <span>·</span>
              <Link to="/acceptable-use" className="hover:text-foreground transition-colors">Acceptable Use</Link>
              <span>·</span>
              <button onClick={() => window.dispatchEvent(new CustomEvent('pivt:open-cookie-prefs'))} className="hover:text-foreground transition-colors">Cookie Preferences</button>
            </div>
          </div>
        </footer>
      </main>

      <DealWizard />
      <NewtonDealIntelligence />
      <SupportPanel />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <ImportDataModal open={importOpen} onClose={() => setImportOpen(false)} />
      <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
      <OnboardingWizard
        open={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onPickDemo={() => {
          // Route into the first demo deal — works for both first-run users
          // and re-runs since demo deals are always present in the workspace.
          (async () => {
            const { supabase } = await import('@/integrations/supabase/client');
            const { data } = await supabase
              .from('deals')
              .select('id')
              .eq('is_demo', true)
              .limit(1)
              .maybeSingle();
            if (data?.id) {
              navigate(`/?section=deals&dealId=${data.id}`);
            } else {
              navigate('/?section=deals');
            }
          })();
        }}
      />
    </div>
    </TooltipProvider>
  );
};
