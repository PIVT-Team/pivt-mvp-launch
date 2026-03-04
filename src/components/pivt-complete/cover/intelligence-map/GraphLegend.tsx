import React from 'react';

const NODE_TYPES = [
  { label: 'Deal', color: '#7C3AED' },
  { label: 'Stakeholder', color: '#A78BFA' },
  { label: 'Document', color: '#22C55E' },
  { label: 'Obligation', color: '#8B5CF6' },
  { label: 'Compliance', color: '#06B6D4' },
  { label: 'Approval', color: '#3B82F6' },
  { label: 'Payment', color: '#F59E0B' },
  { label: 'Settlement', color: '#10B981' },
  { label: 'Waterfall', color: '#C084FC' },
  { label: 'Discrepancy', color: '#EF4444' },
];

const STATUSES = [
  { label: 'Not Started', color: 'hsl(var(--muted-foreground))', style: 'solid' },
  { label: 'In Progress', color: '#3B82F6', style: 'solid' },
  { label: 'Complete', color: '#22C55E', style: 'solid' },
  { label: 'Needs Attention', color: '#F59E0B', style: 'dashed' },
  { label: 'Blocked/Failed', color: '#EF4444', style: 'solid' },
];

const EDGE_STYLES = [
  { label: 'Required (REQUIRES)', dash: false, color: 'hsl(var(--muted-foreground))', thick: false },
  { label: 'Derived (DERIVED_FROM)', dash: true, color: 'hsl(var(--muted-foreground))', thick: false },
  { label: 'Blocking (BLOCKS)', dash: false, color: '#EF4444', thick: true },
];

export const GraphLegend: React.FC<{ collapsed?: boolean }> = ({ collapsed }) => {
  if (collapsed) return null;

  return (
    <div className="absolute bottom-3 left-3 z-10 rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-lg p-3 space-y-3 w-56 text-[11px]">
      <p className="font-semibold text-xs text-foreground">Legend</p>

      {/* Node types */}
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Node Types</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
          {NODE_TYPES.map(n => (
            <div key={n.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.color }} />
              <span className="text-muted-foreground">{n.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Statuses */}
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Status Ring</p>
        <div className="space-y-0.5">
          {STATUSES.map(s => (
            <div key={s.label} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0 border-2"
                style={{
                  borderColor: s.color,
                  borderStyle: s.style as any,
                  background: 'transparent',
                }}
              />
              <span className="text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Edge styles */}
      <div className="space-y-1">
        <p className="text-muted-foreground font-medium uppercase tracking-wider text-[9px]">Relationships</p>
        <div className="space-y-0.5">
          {EDGE_STYLES.map(e => (
            <div key={e.label} className="flex items-center gap-1.5">
              <svg width="16" height="6" className="shrink-0">
                <line
                  x1="0" y1="3" x2="16" y2="3"
                  stroke={e.color}
                  strokeWidth={e.thick ? 3 : 1.5}
                  strokeDasharray={e.dash ? '3 2' : undefined}
                />
              </svg>
              <span className="text-muted-foreground">{e.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
