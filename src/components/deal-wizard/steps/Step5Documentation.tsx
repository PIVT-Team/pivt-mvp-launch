import React from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, X, Sparkles } from 'lucide-react';
import { useDealWizardStore, DocUpload } from '@/stores/dealWizardStore';

const DOC_TYPES = ['Cap Table', 'Waterfall', 'Escrow Agreement', 'Funds Flow', 'Fee Schedule'];

export const Step5Documentation: React.FC = () => {
  const { documents, addDocument, removeDocument, wizardMode } = useDealWizardStore();

  const handleUpload = (type: string) => {
    const id = `doc-${Date.now()}`;
    addDocument({
      id,
      name: `${type.replace(/ /g, '_')}_upload.pdf`,
      type,
      status: 'uploaded',
    });
    // Simulate parse after 1s
    setTimeout(() => {
      useDealWizardStore.setState((s) => ({
        documents: s.documents.map(d => d.id === id ? { ...d, status: 'parsed' as const } : d),
      }));
    }, 1000);
  };

  const handleUseSample = () => {
    const DEMO_DOCS: DocUpload[] = [
      { id: `s-${Date.now()}-1`, name: 'Cap Table - ATLAS.xlsx', type: 'Cap Table', status: 'parsed', isSample: true },
      { id: `s-${Date.now()}-2`, name: 'Waterfall Schedule v3.xlsx', type: 'Waterfall', status: 'parsed', isSample: true },
      { id: `s-${Date.now()}-3`, name: 'Escrow Agreement.pdf', type: 'Escrow Agreement', status: 'parsed', isSample: true },
      { id: `s-${Date.now()}-4`, name: 'Funds Flow Memo.pdf', type: 'Funds Flow', status: 'parsed', isSample: true },
      { id: `s-${Date.now()}-5`, name: 'Fee Schedule.xlsx', type: 'Fee Schedule', status: 'parsed', isSample: true },
    ];
    DEMO_DOCS.forEach(d => addDocument(d));
  };

  const statusConfig = {
    uploaded: { icon: Upload, color: 'text-amber-400', label: 'Processing…' },
    parsed: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Parsed' },
    error: { icon: AlertCircle, color: 'text-red-400', label: 'Error' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Documentation Upload</h2>
        <p className="text-sm text-white/40 mt-1">Upload deal documents for validation</p>
      </div>

      {wizardMode === 'demo' && documents.length === 0 && (
        <button
          onClick={handleUseSample}
          className="w-full py-3 rounded-lg bg-[#5B3DF5]/10 border border-[#5B3DF5]/20 text-[#5B3DF5] text-sm font-medium hover:bg-[#5B3DF5]/20 transition-all flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Use Sample Documents (Demo)
        </button>
      )}

      {/* Upload buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {DOC_TYPES.map(type => {
          const exists = documents.some(d => d.type === type);
          return (
            <button
              key={type}
              onClick={() => !exists && handleUpload(type)}
              disabled={exists}
              className={`p-3 rounded-lg border text-left text-xs font-medium transition-all ${
                exists
                  ? 'bg-[#2A2F3A]/50 border-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-[#2A2F3A] border-white/10 text-white/60 hover:border-[#5B3DF5]/30 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5 mb-1" />
              {type}
            </button>
          );
        })}
      </div>

      {/* Document cards */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map(doc => {
            const cfg = statusConfig[doc.status];
            const Icon = cfg.icon;
            return (
              <div key={doc.id} className="flex items-center gap-3 p-3 bg-[#2A2F3A] rounded-lg border border-white/5">
                <FileText className="w-4 h-4 text-white/30 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{doc.name}</p>
                  <p className="text-xs text-white/30">{doc.type}{doc.isSample ? ' • Sample' : ''}</p>
                </div>
                <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.label}
                </span>
                <button onClick={() => removeDocument(doc.id)} className="text-white/20 hover:text-white/50 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
