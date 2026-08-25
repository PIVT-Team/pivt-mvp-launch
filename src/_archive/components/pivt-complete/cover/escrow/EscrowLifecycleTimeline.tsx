import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';

interface TimelineEvent {
  date: string;
  label: string;
  status: 'completed' | 'active' | 'upcoming';
}

interface Props {
  events: TimelineEvent[];
}

export const EscrowLifecycleTimeline: React.FC<Props> = ({ events }) => {
  return (
    <motion.div {...fadeInUp} className="pivt-card p-5 space-y-4">
      <h3 className="font-medium">Escrow Lifecycle</h3>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
        <div className="space-y-4">
          {events.map((evt, i) => (
            <div key={i} className="flex items-start gap-4 relative">
              <div className={`w-[15px] h-[15px] rounded-full border-2 shrink-0 z-10 ${
                evt.status === 'completed' ? 'bg-validated border-validated' :
                evt.status === 'active' ? 'bg-accent border-accent animate-pulse' :
                'bg-background border-muted-foreground/40'
              }`} />
              <div className="flex-1 pb-1">
                <p className={`text-sm font-medium ${evt.status === 'upcoming' ? 'text-muted-foreground' : ''}`}>
                  {evt.label}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{evt.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
