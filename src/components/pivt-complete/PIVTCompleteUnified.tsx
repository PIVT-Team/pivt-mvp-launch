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
      className="flex h-screen overflow-hidden transition-colors duration-300"
      style={{
        background: isCover ? 'hsl(var(--background))' : '#0B0B0B',
        color: isCover ? 'hsl(var(--foreground))' : '#fff',
      }}
    >
      {/* Sidebar */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        transition={springConfig.standard}
        className="h-full flex flex-col border-r shrink-0 overflow-hidden"
        style={{
          background: isCover ? 'hsl(var(--sidebar-background))' : '#0B0B0B',
          borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.08)',
        }}
      >
        {/* Logo */}
        <div className="p-4 flex flex-col items-center gap-1">
          <motion.img
            src={pivtLogo}
            alt="PIVT"
            className={`${sidebarCollapsed ? 'h-10' : 'h-20'} w-auto shrink-0 transition-all duration-300`}
            style={{ transformStyle: 'preserve-3d' }}
            animate={{ rotateY: [0, 0, -180, -180, 0, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', times: [0, 0.15, 0.4, 0.6, 0.85, 1] }}
          />
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-xs text-white/70 tracking-[0.1em] uppercase font-semibold">Payout Initiation Verification Technology</p>
              <p className="text-xs text-white/50 italic mt-1.5 whitespace-nowrap">The Intelligence Layer Behind Every Close</p>
            </motion.div>
          )}
        </div>

        {/* Deal selector */}
        {!sidebarCollapsed && (
          <div className="px-3 mb-2">
            <select
              value={selectedDealId}
              onChange={(e) => setSelectedDealId(e.target.value)}
              className="w-full text-xs rounded-md px-2 py-1.5 border bg-transparent focus:outline-none"
              style={{
                borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.1)',
                color: isCover ? 'hsl(var(--sidebar-foreground))' : '#fff',
              }}
            >
              {deals.map(d => (
                <option key={d.id} value={d.id} style={{ background: '#111', color: '#fff' }}>
                  {d.codeName} — ${(d.consideration / 1e9).toFixed(1)}B
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Nav items */}
        <nav className="flex-1 px-2 py-2 space-y-3 overflow-y-auto">
          {navGroups.map((group) => (
            <div key={group.category}>
              {!sidebarCollapsed && (
                <p
                  className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.35)' }}
                >
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
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive
                          ? 'bg-accent/10 text-accent'
                          : isCover
                            ? 'text-sidebar-foreground hover:bg-sidebar-accent'
                            : 'text-white/50 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {!sidebarCollapsed && (
                        <span className="flex-1 text-left">{item.label}</span>
                      )}
                      {!sidebarCollapsed && item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-medium">
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

        {/* Bottom controls */}
        <div className="p-3 border-t" style={{ borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.08)' }}>

          {/* Collapse toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: isCover ? 'hsl(var(--sidebar-foreground))' : 'rgba(255,255,255,0.4)' }}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </motion.aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col">
        {/* Top header bar */}
        <div className="shrink-0 px-6 py-3 flex items-center gap-3 border-b" style={{ borderColor: isCover ? 'hsl(var(--border))' : 'rgba(255,255,255,0.08)' }}>
          {/* Search */}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm text-muted-foreground hover:bg-muted/50 transition-colors flex-1 max-w-md"
            style={{ borderColor: isCover ? 'hsl(var(--border))' : 'rgba(255,255,255,0.1)' }}
          >
            <Search className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Search deals, stakeholders...</span>
            <kbd className="px-1.5 py-0.5 text-xs rounded border bg-muted font-mono">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* Cover / Glass toggle */}
          <div className="flex items-center bg-muted/50 rounded-full p-0.5">
            <button
              onClick={() => setViewMode('cover')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isCover ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Cover
            </button>
            <button
              onClick={() => setViewMode('glass')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                !isCover ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Glass
            </button>
          </div>

          {/* Notifications */}
          <button
            onClick={() => setActiveSection('notifications')}
            className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
            style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.6)' }}
          >
            <Bell className="w-5 h-5" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-blocking text-white text-[9px] font-bold flex items-center justify-center">3</span>
          </button>

          {/* Import Data */}
          <button
            onClick={() => setActiveSection('ingestion')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium hover:bg-muted/50 transition-colors"
            style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.6)' }}
          >
            <Upload className="w-4 h-4" />
            Import Data
          </button>

          {/* Settings */}
          <button
            onClick={() => setActiveSection('settings')}
            className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
            style={{ color: isCover ? 'hsl(var(--muted-foreground))' : 'rgba(255,255,255,0.6)' }}
          >
            <Settings className="w-5 h-5" />
          </button>

          {/* User avatar */}
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-sm font-semibold cursor-pointer">
            SC
          </div>
        </div>
        <AnimatePresence mode="wait">
          {isCover ? (
            <motion.div
              key={`cover-${activeSection}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springConfig.standard}
              className="p-8 max-w-6xl mx-auto"
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
