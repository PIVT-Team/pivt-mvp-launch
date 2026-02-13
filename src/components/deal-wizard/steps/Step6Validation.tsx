import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Play } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

export const Step6Validation: React.FC = () => {
  const { validationResults, runValidation } = useDealWizardStore();

  const icons = {
    pass: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    fail: <XCircle className="w-4 h-4 text-red-400" />,
  };

  const fails = validationResults.filter(v => v.status === 'fail').length;
  const warns = validationResults.filter(v => v.status === 'warning').length;
  const allPass = validationResults.length > 0 && fails === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Validation Results</h2>
        <p className="text-sm text-white/40 mt-1">Automated cross-reference checks</p>
      </div>

      {validationResults.length === 0 ? (
        <div className="text-center py-12">
          <button
            onClick={runValidation}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#5B3DF5] text-white rounded-lg font-medium hover:bg-[#5B3DF5]/80 transition-all"
          >
            <Play className="w-4 h-4" />
            Run Validation
          </button>
          <p className="text-xs text-white/30 mt-3">Analyzes uploaded documents for discrepancies</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className={`p-4 rounded-lg border ${
            allPass
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : 'bg-red-500/5 border-red-500/20'
          }`}>
            <p className={`text-sm font-semibold ${allPass ? 'text-emerald-400' : 'text-red-400'}`}>
              {allPass
                ? '✓ All checks passed'
                : `${fails} issue${fails !== 1 ? 's' : ''} found${warns > 0 ? `, ${warns} warning${warns !== 1 ? 's' : ''}` : ''}`
              }
            </p>
          </div>

          {/* Results */}
          <div className="space-y-2">
            {validationResults.map(v => (
              <div key={v.id} className="flex items-start gap-3 p-3 bg-[#2A2F3A] rounded-lg border border-white/5">
                <span className="mt-0.5">{icons[v.status]}</span>
                <div>
                  <p className="text-sm font-medium text-white">{v.check}</p>
                  <p className="text-xs text-white/40 mt-0.5">{v.message}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
