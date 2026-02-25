import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ReportFormat = 'PDF' | 'CSV' | 'XLSX' | 'JSON';
export type ReportStatus = 'generating' | 'ready' | 'failed';
export type ReportScope = 'deal' | 'portfolio';

export interface GeneratedReport {
  id: string;
  reportTypeId: string;
  reportName: string;
  scope: ReportScope;
  scopeLabel: string;
  format: ReportFormat;
  status: ReportStatus;
  generatedAt: string;
  fileBlob?: Blob;
  fileName: string;
  error?: string;
  dateRange?: { start: string; end: string };
}

interface ReportStore {
  history: GeneratedReport[];
  activeGeneration: string | null;
  addReport: (report: GeneratedReport) => void;
  updateReport: (id: string, updates: Partial<GeneratedReport>) => void;
  removeReport: (id: string) => void;
  setActiveGeneration: (id: string | null) => void;
  getByType: (typeId: string) => GeneratedReport[];
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set, get) => ({
      history: [],
      activeGeneration: null,
      addReport: (report) => set((s) => ({ history: [report, ...s.history] })),
      updateReport: (id, updates) =>
        set((s) => ({
          history: s.history.map((r) => (r.id === id ? { ...r, ...updates } : r)),
        })),
      removeReport: (id) => set((s) => ({ history: s.history.filter((r) => r.id !== id) })),
      setActiveGeneration: (id) => set({ activeGeneration: id }),
      getByType: (typeId) => get().history.filter((r) => r.reportTypeId === typeId),
    }),
    {
      name: 'pivt-report-history',
      partialize: (state) => ({
        // Don't persist blobs or active generation
        history: state.history.map(({ fileBlob, ...rest }) => rest),
      }),
    }
  )
);
