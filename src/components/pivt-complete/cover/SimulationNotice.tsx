import React from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * States plainly that no money moves.
 *
 * `disbursement-engine` executes wires through a `MockProvider` that returns
 * simulated references — there is no bank API and no settlement. The UI around
 * it reads as a real execution flow, with statuses that look like payments
 * being sent, and the audit log records "wire executed".
 *
 * Someone has to be able to tell the difference between a rehearsal and a
 * $120m transfer by looking at the screen. Until the provider is real, this
 * says so where the action is taken rather than in a README.
 */
export const SimulationNotice: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl border border-discrepancy/30 bg-discrepancy/5 ${className}`}>
    <FlaskConical className="w-4 h-4 text-discrepancy shrink-0 mt-0.5" />
    <div className="text-xs leading-relaxed">
      <span className="font-medium">Simulation — no funds move.</span>{' '}
      Execution here runs against a mock payment provider. Statuses, references and
      audit entries are generated for rehearsal; nothing is sent to a bank. Do not
      treat a completed run as evidence that a payment was made.
    </div>
  </div>
);
