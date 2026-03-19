/**
 * WirePackSuccessCard — Premium, animated success moment
 * for wire pack completion. Reusable across Newton, manual flows, and demo.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Download, FileText, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WirePackSuccessProps {
  dealName: string;
  totalAmount?: string;
  wireCount?: number;
  timestamp?: string;
  /** Compact mode for Newton chat cards */
  compact?: boolean;
  onViewWirePack?: () => void;
  onDownloadPDF?: () => void;
  onProceedToExecution?: () => void;
}

const fmtTime = (ts?: string) => {
  if (!ts) return new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return new Date(ts).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

export const WirePackSuccessCard: React.FC<WirePackSuccessProps> = ({
  dealName,
  totalAmount,
  wireCount,
  timestamp,
  compact = false,
  onViewWirePack,
  onDownloadPDF,
  onProceedToExecution,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28, mass: 0.9 }}
      className="relative overflow-hidden"
    >
      {/* Outer container */}
      <div
        className={`relative rounded-2xl border-2 overflow-hidden ${
          compact ? 'p-4' : 'p-6'
        }`}
        style={{
          borderColor: 'hsl(var(--validated) / 0.3)',
          background: 'linear-gradient(135deg, hsl(var(--validated) / 0.06), hsl(var(--card)))',
        }}
      >
        {/* Subtle glow pulse overlay */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          initial={{ opacity: 0.5 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeOut' }}
          style={{
            background: 'radial-gradient(ellipse at center, hsl(var(--validated) / 0.12) 0%, transparent 70%)',
          }}
        />

        {/* Content */}
        <div className="relative z-10">
          {/* Icon + headline */}
          <div className={`flex items-start gap-${compact ? '3' : '4'}`}>
            {/* Animated check icon */}
            <motion.div
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.15 }}
              className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} rounded-2xl flex items-center justify-center shrink-0`}
              style={{
                background: 'linear-gradient(135deg, hsl(var(--validated) / 0.15), hsl(var(--validated) / 0.08))',
                boxShadow: '0 4px 20px -4px hsl(var(--validated) / 0.25)',
              }}
            >
              <CheckCircle2
                className={`${compact ? 'w-5 h-5' : 'w-7 h-7'}`}
                style={{ color: 'hsl(var(--validated))' }}
              />
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.h3
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.3 }}
                className={`${compact ? 'text-base' : 'text-xl'} font-bold tracking-tight text-foreground`}
              >
                Wire Pack Ready
              </motion.h3>
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className={`${compact ? 'text-xs' : 'text-sm'} text-muted-foreground mt-0.5`}
              >
                All approvals completed. Bank-compatible wire pack generated.
              </motion.p>
            </div>
          </div>

          {/* Metadata pills */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className={`grid ${compact ? 'grid-cols-2 gap-2 mt-3' : 'grid-cols-3 gap-3 mt-5'}`}
          >
            <div
              className="rounded-xl px-3 py-2.5"
              style={{ background: 'hsl(var(--muted) / 0.5)' }}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Deal
              </p>
              <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-foreground mt-0.5 truncate`}>
                {dealName}
              </p>
            </div>
            {totalAmount && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'hsl(var(--muted) / 0.5)' }}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Total
                </p>
                <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-foreground mt-0.5 font-mono`}>
                  {totalAmount}
                </p>
              </div>
            )}
            {wireCount != null && !compact && (
              <div
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'hsl(var(--muted) / 0.5)' }}
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Wires
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5 font-mono">
                  {wireCount} verified
                </p>
              </div>
            )}
          </motion.div>

          {/* Checklist */}
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
            className={`${compact ? 'mt-3 space-y-1' : 'mt-4 space-y-1.5'}`}
          >
            {[
              wireCount ? `${wireCount} verified wire instructions` : 'All wire instructions verified',
              'All discrepancies resolved',
              'All required approvals complete',
              'Compliance checks passed',
            ].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + i * 0.08, duration: 0.2 }}
                className="flex items-center gap-2"
              >
                <CheckCircle2
                  className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0`}
                  style={{ color: 'hsl(var(--validated))' }}
                />
                <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-medium`} style={{ color: 'hsl(var(--validated))' }}>
                  {item}
                </span>
              </motion.div>
            ))}
          </motion.div>

          {/* Timestamp */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className={`text-[10px] text-muted-foreground/60 ${compact ? 'mt-2' : 'mt-3'}`}
          >
            Generated {fmtTime(timestamp)}
          </motion.p>

          {/* CTA Buttons */}
          {(onViewWirePack || onDownloadPDF || onProceedToExecution) && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.75, duration: 0.25 }}
              className={`flex flex-wrap gap-2 ${compact ? 'mt-3' : 'mt-5'}`}
            >
              {onViewWirePack && (
                <Button
                  size={compact ? 'sm' : 'default'}
                  variant="outline"
                  onClick={onViewWirePack}
                  className={`${compact ? 'h-8 text-xs' : 'h-9 text-sm'} rounded-xl gap-1.5`}
                >
                  <FileText className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                  View Wire Pack
                </Button>
              )}
              {onDownloadPDF && (
                <Button
                  size={compact ? 'sm' : 'default'}
                  variant="outline"
                  onClick={onDownloadPDF}
                  className={`${compact ? 'h-8 text-xs' : 'h-9 text-sm'} rounded-xl gap-1.5`}
                >
                  <Download className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                  Download PDF
                </Button>
              )}
              {onProceedToExecution && (
                <Button
                  size={compact ? 'sm' : 'default'}
                  onClick={onProceedToExecution}
                  className={`${compact ? 'h-8 text-xs' : 'h-9 text-sm'} rounded-xl gap-1.5 bg-gradient-to-r from-[hsl(var(--accent))] to-[hsl(var(--pivt-blue))] text-white border-0 hover:opacity-90`}
                >
                  Proceed to Execution
                  <ArrowRight className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
                </Button>
              )}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
