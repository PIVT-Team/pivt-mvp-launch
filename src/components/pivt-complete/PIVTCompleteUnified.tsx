/**
 * PIVTCompleteUnified - Unified Cover/Glass Mode Interface
 */
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { springConfig } from '@/lib/animations';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { groupedNavigationByMode } from '@/lib/navigation';
import { Sun, Moon, Search, ChevronLeft, ChevronRight, Bell, Settings, Upload, Eye, Layers } from 'lucide-react';
import pivtLogo from '@/assets/pivt-logo.png';
import { CommandPalette } from './CommandPalette';

// Cover sections
import { CommandCenterCover } from './cover/CommandCenterCover';
import { DealsCover } from './cover/DealsCover';
import { WaterfallCover } from './cover/WaterfallCover';
import { StakeholdersCover } from './cover/StakeholdersCover';
import { DocumentsCover } from './cover/DocumentsCover';
import { EscrowCover } from './cover/EscrowCover';
import { ApprovalsCover } from './cover/ApprovalsCover';
import { PaymentsCover } from './cover/PaymentsCover';
import { AuditCover, ReportsCover } from './cover/AuditAndReports';

import { DemoExperienceCover } from './cover/DemoExperienceCover';
import { DocumentIngestionCover } from './cover/DocumentIngestionCover';
import { ClosingCenterCover } from './cover/ClosingCenterCover';
import { NewtonCover } from './cover/NewtonCover';
import { VerificationCover } from './cover/VerificationCover';
import { AdminVerificationQueue } from './cover/AdminVerificationQueue';
import { MessagesCover } from './cover/MessagesCover';
import { NotificationsCover } from './cover/NotificationsCover';
import { CapTableCover } from './cover/CapTableCover';
import { DealWorkspaceCover } from './cover/DealWorkspaceCover';
import { RecipientDashboardCover } from './cover/RecipientDashboardCover';
import { LPPortalCover } from './cover/LPPortalCover';
import { OnboardingCover } from './cover/OnboardingCover';
import { MCPIntegrationsCover } from './cover/MCPIntegrationsCover';
import { GlassCockpitCover } from './cover/GlassCockpitCover';
import { SettingsCover } from './cover/SettingsCover';
import { IntegrationsCover } from './cover/IntegrationsCover';
import { AutonomyCover } from './cover/AutonomyCover';

// Glass
import { GlassOntology } from './glass/GlassOntology';

// Global floating chat
import { NewtonGlobalChat } from '../newton/NewtonGlobalChat';

// Deal Wizard
import { DealWizard } from '../deal-wizard/DealWizard';

const coverSections: Record<ActiveSection, React.FC> = {
  command: CommandCenterCover,
  deals: DealsCover,
  demo: DemoExperienceCover,
  waterfall: WaterfallCover,
  stakeholders: StakeholdersCover,
  documents: DocumentsCover,
  ingestion: DocumentIngestionCover,
  escrow: EscrowCover,
  closing: ClosingCenterCover,
  approvals: ApprovalsCover,
  payments: PaymentsCover,
  audit: AuditCover,
  reports: ReportsCover,
  newton: NewtonCover,
  verification: VerificationCover,
  'admin-verification': AdminVerificationQueue,
  messages: MessagesCover,
  notifications: NotificationsCover,
  'cap-table': CapTableCover,
  workspace: DealWorkspaceCover,
  recipient: RecipientDashboardCover,
  'lp-portal': LPPortalCover,
  onboarding: OnboardingCover,
  mcp: MCPIntegrationsCover,
  cockpit: GlassCockpitCover,
  settings: SettingsCover,
  integrations: IntegrationsCover,
  autonomy: AutonomyCover,
};

export const PIVTCompleteUnified: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    viewMode, activeSection, setViewMode, setActiveSection,
    toggleMode, deals, selectedDealId, setSelectedDealId,
  } = usePIVTStore();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const navGroups = groupedNavigationByMode.manda;

  // Sync URL params
  useEffect(() => {
    const mode = searchParams.get('mode');
    const section = searchParams.get('section');
    if (mode === 'glass' || mode === 'cover') setViewMode(mode);
    if (section) setActiveSection(section as ActiveSection);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (viewMode === 'glass') params.set('mode', 'glass');
    if (activeSection !== 'command') params.set('section', activeSection);
    setSearchParams(params, { replace: true });
  }, [viewMode, activeSection]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        toggleMode();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleMode]);

  const ActiveCoverSection = coverSections[activeSection] || CommandCenterCover;
  const isCover = viewMode === 'cover';

  return (
    <div
      className="flex h-screen overflow-hidden transition-colors duration-300 pivt-ambient-bg"
      style={{
        color: isCover ? 'hsl(var(--foreground))' : '#fff',
      }}
    >
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 56 : 232 }}
        transition={springConfig.standard}
        className="h-full flex flex-col border-r shrink-0 overflow-hidden"
        style={{
          background: isCover ? 'hsl(var(--sidebar-background))' : '#08090E',
          borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-3 flex flex-col items-center gap-1.5">
          <motion.img
            src={pivtLogo}
            alt="PIVT"
            className={`${sidebarCollapsed ? 'h-8' : 'h-16'} w-auto shrink-0 transition-all duration-300`}
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: [0, 0, -180, -180, 0, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', times: [0, 0.15, 0.4, 0.6, 0.85, 1] }}
          />
          {!sidebarCollapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[9px] text-white/30 italic text-center whitespace-nowrap"
            >
              The intelligence layer behind every close.
            </motion.p>
          )}
        </div>

        {/* Deal selector */}
        {!sidebarCollapsed && (
          <div className="px-3 mb-3">
            <select
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              className="w-full text-[11px] font-medium rounded-lg px-2.5 py-2 border bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/30 transition-all"
              style={{
                borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.08)',
                color: isCover ? 'hsl(var(--sidebar-foreground))' : 'rgba(255,255,255,0.7)',
              }}
            >
              {deals.map(d => (
                <option key={d.id} value={d.id} style={{ background: '#0D0E14', color: '#fff' }}>
                  {d.codeName} — ${(d.consideration / 1e9).toFixed(1)}B
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Subtle divider */}
        <div className="mx-4 mb-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }} />

        {/* Nav items */}
        <nav className="flex-1 px-2.5 py-1 space-y-4 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.category}>
              {!sidebarCollapsed && (
                <p className="pivt-section-label px-2.5 py-1.5">
                  {group.category}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeSection === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => setActiveSection(item.path as ActiveSection)}
                      className={`pivt-nav-item ${
                        isActive
                          ? 'pivt-nav-item-active'
                          : isCover
                            ? 'text-sidebar-foreground'
                            : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" style={{ color: isActive ? undefined : item.iconColor }} />
                      {!sidebarCollapsed && (
                        <span className="flex-1 text-left truncate">{item.label}</span>
                      )}
                      {!sidebarCollapsed && item.badge && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-accent/15 text-accent font-semibold tabular-nums">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2.5 border-t" style={{ borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.05)' }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-white/4 transition-colors"
            style={{ color: isCover ? 'hsl(var(--sidebar-foreground))' : 'rgba(255,255,255,0.3)' }}
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top header bar */}
        <div
          className="shrink-0 px-6 py-3.5 flex items-center gap-4 border-b"
          style={{ borderColor: isCover ? 'hsl(var(--border))' : 'rgba(255,255,255,0.06)' }}
        >
          {/* Search */}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg border text-[13px] text-muted-foreground hover:bg-muted/30 transition-all flex-1 max-w-md"
            style={{ borderColor: isCover ? 'hsl(var(--border))' : 'rgba(255,255,255,0.07)' }}
          >
            <Search className="w-3.5 h-3.5 shrink-0 opacity-50" />
            <span className="flex-1 text-left">Search deals, stakeholders...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] rounded border bg-muted/50 font-mono opacity-60">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* Cover / Glass toggle */}
          <div className="flex items-center bg-muted/30 rounded-lg p-0.5 border border-border/50">
            <button
              onClick={() => setViewMode('cover')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide uppercase transition-all ${
                isCover ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3 h-3" />
              Cover
            </button>
            <button
              onClick={() => setViewMode('glass')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold tracking-wide uppercase transition-all ${
                !isCover ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3 h-3" />
              Glass
            </button>
          </div>

          {/* Notifications */}
          <button
            onClick={() => setActiveSection('notifications')}
            className="relative p-2 rounded-lg hover:bg-muted/30 transition-colors"
            style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.5)' }}
          >
            <Bell className="w-4.5 h-4.5" />
            <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-blocking text-white text-[8px] font-bold flex items-center justify-center">3</span>
          </button>

          {/* Import Data */}
          <button
            onClick={() => setActiveSection('ingestion')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-muted/30 transition-colors"
            style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.5)' }}
          >
            <Upload className="w-3.5 h-3.5" />
            Import
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveSection('settings')}
            className="p-2 rounded-lg hover:bg-muted/30 transition-colors"
            style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.5)' }}
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center text-accent text-[11px] font-bold cursor-pointer tracking-wide">
            SC
          </div>
        </div>
        <AnimatePresence mode="wait">
          {isCover ? (
            <motion.div
              key={`cover-${activeSection}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={springConfig.standard}
              className="p-8 lg:p-10 max-w-6xl mx-auto w-full"
            >
              <ActiveCoverSection />
            </motion.div>
          ) : (
            <motion.div
              key="glass"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={springConfig.modeTransition}
              className="h-full"
            >
              <GlassOntology />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Newton floating chat (available everywhere) */}
      <NewtonGlobalChat />

      {/* Deal Intake Wizard */}
      <DealWizard />

      {/* Command Palette */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
};
