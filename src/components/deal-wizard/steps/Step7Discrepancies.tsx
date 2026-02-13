import React from 'react';
import { CheckCircle2, MessageSquare } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

export const Step7Discrepancies: React.FC = () => {
  const { discrepancies, resolveDiscrepancy } = useDealWizardStore();
  const unresolvedHigh = discrepancies.filter(d => d.severity === 'high' && !d.resolved).length;

  const severityColor = {
    high: 'text-red-400 bg-red-500/10 border-red-500/20',
    medium: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Discrepancies</h2>
        <p className="text-sm text-white/40 mt-1">
          {discrepancies.length === 0
            ? 'No discrepancies detected'
            : `${discrepancies.filter(d => !d.resolved).length} unresolved of ${discrepancies.length} total`}
        </p>
      </div>

      {unresolvedHigh > 0 && (
        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20 text-xs text-red-400 font-medium">
          ⚠ {unresolvedHigh} high-severity discrepanc{unresolvedHigh === 1 ? 'y' : 'ies'} must be resolved before proceeding
        </div>
      )}

      {discrepancies.length === 0 ? (
        <div className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-white/60">No discrepancies — ready to proceed</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-white/40 border-b border-white/10">
                <th className="text-left py-2 px-3 font-medium">Line Item</th>
                <th className="text-left py-2 px-3 font-medium">Expected</th>
                <th className="text-left py-2 px-3 font-medium">Provided</th>
                <th className="text-left py-2 px-3 font-medium">Variance</th>
                <th className="text-left py-2 px-3 font-medium">Severity</th>
                <th className="text-left py-2 px-3 font-medium">Assigned</th>
                <th className="text-right py-2 px-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {discrepancies.map(d => (
                <tr key={d.id} className={`border-b border-white/5 ${d.resolved ? 'opacity-40' : ''}`}>
                  <td className="py-3 px-3 text-white font-medium">{d.lineItem}</td>
                  <td className="py-3 px-3 text-white/60 font-mono text-xs">{d.expected}</td>
                  <td className="py-3 px-3 text-white/60 font-mono text-xs">{d.provided}</td>
                  <td className="py-3 px-3 text-white/60 font-mono text-xs">{d.variance}</td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${severityColor[d.severity]}`}>
                      {d.severity}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-white/50 text-xs">{d.assignedTo}</td>
                  <td className="py-3 px-3 text-right">
                    {d.resolved ? (
                      <span className="text-xs text-emerald-400 font-medium">Resolved</span>
                    ) : (
                      <button
                        onClick={() => resolveDiscrepancy(d.id)}
                        className="text-xs text-[#5B3DF5] hover:text-[#5B3DF5]/80 font-medium transition-colors"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
