/**
 * PIVTCompleteUnified - Unified Cover/Glass Mode Interface
 */
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { springConfig } from '@/lib/animations';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';
import { navigationByMode } from '@/lib/navigation';
import { Sun, Moon, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import pivtLogo from '@/assets/pivt-logo.png';

// Cover sections
import { CommandCenterCover } from './cover/CommandCenterCover';
import { DealsCover } from './cover/DealsCover';
import { WaterfallCover } from './cover/WaterfallCover';
import { StakeholdersCover } from './cover/StakeholdersCover';
import { DocumentsCover } from './cover/DocumentsCover';
import { EscrowCover } from './cover/EscrowCover';
import { ApprovalsCover } from './cover/ApprovalsCover';
import { PaymentsCover } from './cover/PaymentsCover';
import { AuditCover } from './cover/AuditAndReports';
import { AnalyticsDashboard } from './cover/AnalyticsDashboard';
import { DemoExperienceCover } from './cover/DemoExperienceCover';
import { DocumentIngestionCover } from './cover/DocumentIngestionCover';
import { ClosingCenterCover } from './cover/ClosingCenterCover';
import { NewtonCover } from './cover/NewtonCover';

// Glass
import { GlassOntology } from './glass/GlassOntology';

// Global floating chat
import { NewtonGlobalChat } from '../newton/NewtonGlobalChat';

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
  reports: AnalyticsDashboard,
  newton: NewtonCover,
};

export const PIVTCompleteUnified: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    viewMode, activeSection, setViewMode, setActiveSection,
    toggleMode, deals, selectedDealId, setSelectedDealId,
  } = usePIVTStore();

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const nav = navigationByMode.manda;

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
        <div className="p-4 flex items-center gap-3">
          <img src={pivtLogo} alt="PIVT" className="h-8 w-auto shrink-0" />
          {!sidebarCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-semibold text-white tracking-wide"
            >
            </motion.span>
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
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
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
                {!sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom controls */}
        <div className="p-3 border-t space-y-2" style={{ borderColor: isCover ? 'hsl(var(--sidebar-border))' : 'rgba(255,255,255,0.08)' }}>
          {/* Mode toggle */}
          <button
            onClick={toggleMode}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-white/5"
            style={{ color: isCover ? 'hsl(var(--sidebar-foreground))' : '#fff' }}
          >
            {isCover ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {!sidebarCollapsed && <span>{isCover ? 'Glass Mode' : 'Cover Mode'}</span>}
            {!sidebarCollapsed && <span className="ml-auto text-xs opacity-40">⌘G</span>}
          </button>

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
      <main className="flex-1 overflow-y-auto">
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
    </div>
  );
};
