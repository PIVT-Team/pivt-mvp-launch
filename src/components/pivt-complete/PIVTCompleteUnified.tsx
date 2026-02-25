/**
 * PIVTCompleteUnified - Enterprise-first layout with optional Glass Mode
 * Gradient design system: G1-G5 tokens applied throughout
 */
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { springConfig } from '@/lib/animations';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { groupedNavigationByMode } from '@/lib/navigation';
import { Search, ChevronLeft, ChevronRight, Bell, Upload, User } from 'lucide-react';
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

import { DealWizard } from '../deal-wizard/DealWizard';
import { NewtonDealIntelligence } from '../newton/NewtonDealIntelligence';

const DEAL_SCOPED_SECTIONS = new Set([
  'workspace', 'stakeholders', 'documents', 'escrow', 'approvals',
  'payments', 'ingestion', 'closing', 'verification', 'cap-table',
  'waterfall', 'kyc',
]);

const coverSections: Record<string, React.FC> = {
  deals: DealsCover,
  workspace: DealWorkspaceCover,
  reports: GlobalReportsCover,
  audit: AuditCover,
  settings: SettingsCover,
  integrations: IntegrationsCover,
  'intelligence-map': IntelligenceMapCover,
  timeline: TimelineCover,
};

export const PIVTCompleteUnified: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeSection, setActiveSection, selectedDealId } = usePIVTStore();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const { unreadCount, seedDemoNotifications } = useNotificationStore();

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
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeSection !== 'deals') params.set('section', activeSection);
    setSearchParams(params, { replace: true });
  }, [activeSection]);

  // Deal context locking
  useEffect(() => {
    if (DEAL_SCOPED_SECTIONS.has(activeSection) && activeSection !== 'workspace') {
      setActiveSection(selectedDealId ? 'workspace' : 'deals');
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

  const ActiveCoverSection = coverSections[activeSection] || DealsCover;

  return (
    <div className="flex h-screen overflow-hidden pivt-ambient-bg" style={{ color: 'hsl(var(--foreground))' }}>
      {/* Sidebar — wider, workflow-driven */}
      <motion.aside
        animate={{ width: sidebarCollapsed ? 56 : 260 }}
        transition={springConfig.standard}
        className="h-full flex flex-col shrink-0 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--g4-from)), hsl(var(--g4-to)))',
          borderRight: '1px solid hsl(var(--sidebar-border))',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-5 pb-3 flex flex-col items-center gap-1.5">
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
              className="text-[9px] text-sidebar-foreground/50 italic text-center whitespace-nowrap"
            >
              The intelligence layer behind every close.
            </motion.p>
          )}
        </div>

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
                  const isActive = activeSection === item.path;
                  return (
                    <button
                      key={item.path}
                      onClick={() => setActiveSection(item.path as ActiveSection)}
                      className={`pivt-nav-item ${isActive ? 'pivt-nav-item-active' : 'text-sidebar-foreground'}`}
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
        {/* Top bar */}
        <div
          className="shrink-0 px-6 py-3 flex items-center gap-4 border-b"
          style={{
            background: 'hsl(var(--card))',
            borderColor: 'hsl(var(--border))',
          }}
        >
          {/* Search */}
          <button
            onClick={() => setCommandOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-sm text-muted-foreground hover:bg-muted/40 transition-all flex-1 max-w-md"
            style={{ borderColor: 'hsl(var(--border))' }}
          >
            <Search className="w-4 h-4 shrink-0 opacity-50" />
            <span className="flex-1 text-left">Search deals, stakeholders...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] rounded border bg-muted/50 font-mono opacity-60">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* Glass Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">Glass Mode</span>
            <button
              onClick={toggleGlassMode}
              className="glass-toggle"
              data-active={glassMode}
              title="Toggle Glass Mode (⌘G)"
            >
              <span className="glass-toggle-thumb" />
            </button>
          </div>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Import */}
          <button onClick={() => setImportOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground text-sm" title="Import Data">
            <Upload className="w-4 h-4" />
            <span>Import Data</span>
          </button>

          {/* Notifications */}
          <button onClick={() => setNotifOpen(true)} className="relative p-2 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground" title="Notifications">
            <Bell className="w-4 h-4" />
            {unreadCount() > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount()}
              </span>
            )}
          </button>

          {/* Profile */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold cursor-pointer transition-all duration-200 hover:brightness-105 hover:scale-[1.03]"
            style={{
              background: 'linear-gradient(135deg, #8F6BFF, #2E1F9E)',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(46, 31, 158, 0.25)',
              letterSpacing: '-0.02em',
            }}
          >
            JW
          </div>
        </div>

        <AnimatePresence mode="wait">
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
        </AnimatePresence>
      </main>

      <DealWizard />
      <NewtonDealIntelligence />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <ImportDataModal open={importOpen} onClose={() => setImportOpen(false)} />
      <NotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />
    </div>
  );
};
