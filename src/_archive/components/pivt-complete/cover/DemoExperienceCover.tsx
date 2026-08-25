/**
 * The PIVT Solution — Investor-grade narrative section
 * 4-pillar capability flow with premium hover animations
 */
import React from 'react';
import { motion } from 'framer-motion';

const PILLARS = [
  {
    step: '01',
    title: 'Understand the Deal',
    description: 'AI reads and structures transaction documents into a live system of record.',
    gradient: 'from-accent/20 to-accent/5',
    glowColor: 'hsl(var(--accent) / 0.3)',
    iconPath: (
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    ),
  },
  {
    step: '02',
    title: 'Validate Every Detail',
    description: 'PIVT verifies stakeholders, approvals, and payment logic against binding agreements.',
    gradient: 'from-[hsl(var(--pivt-blue))]/20 to-[hsl(var(--pivt-blue))]/5',
    glowColor: 'hsl(var(--pivt-blue) / 0.3)',
    iconPath: (
      <path
        d="M9 12l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    step: '03',
    title: 'Orchestrate the Close',
    description: 'All conditions, approvals, and dependencies are tracked and enforced in one place.',
    gradient: 'from-accent/20 to-[hsl(var(--pivt-blue))]/10',
    glowColor: 'hsl(var(--accent) / 0.25)',
    iconPath: (
      <>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={1.5} fill="none" />
        <path
          d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M5.6 18.4l2.2-2.2M16.2 7.8l2.2-2.2"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </>
    ),
  },
  {
    step: '04',
    title: 'Execute with Confidence',
    description: 'Payments are triggered only when every condition is satisfied — with a complete audit trail.',
    gradient: 'from-[hsl(var(--pivt-blue))]/20 to-accent/5',
    glowColor: 'hsl(var(--pivt-blue) / 0.3)',
    iconPath: (
      <path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.23, 1, 0.32, 1] as [number, number, number, number] },
  },
};

export const DemoExperienceCover: React.FC = () => {
  return (
    <section className="py-20 px-6 md:px-12 lg:px-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        className="text-center max-w-3xl mx-auto mb-16"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent mb-4">
          The PIVT Solution
        </p>
        <h2 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold leading-tight text-foreground mb-5">
          From Signed Deal to Settled Funds —{' '}
          <span className="bg-gradient-to-r from-accent to-[hsl(var(--pivt-blue))] bg-clip-text text-transparent">
            Without the Chaos
          </span>
        </h2>
        <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          PIVT is the intelligence and orchestration layer that transforms fragmented deal documents,
          approvals, and payment instructions into a single, verified execution workflow.
        </p>
      </motion.div>

      {/* Pillar Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-60px' }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto relative"
      >
        {/* Connecting line (desktop) */}
        <div className="hidden lg:block absolute top-[4.5rem] left-[12%] right-[12%] h-px bg-gradient-to-r from-accent/30 via-[hsl(var(--pivt-blue))]/20 to-accent/30 z-0" />

        {PILLARS.map((pillar, i) => (
          <motion.div
            key={pillar.step}
            variants={itemVariants}
            whileHover={{ y: -6, transition: { duration: 0.25 } }}
            className="relative z-10 group"
          >
            <div
              className="relative rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-7 h-full
                         transition-all duration-300
                         group-hover:border-accent/40 group-hover:shadow-[0_0_30px_-8px_var(--glow)]"
              style={{ '--glow': pillar.glowColor } as React.CSSProperties}
            >
              {/* Icon */}
              <div
                className={`w-12 h-12 rounded-xl bg-gradient-to-br ${pillar.gradient} flex items-center justify-center mb-5
                            border border-border/30 group-hover:border-accent/30 transition-colors`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  className="text-foreground"
                >
                  {pillar.iconPath}
                </svg>
              </div>

              {/* Step number */}
              <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 block">
                Step {pillar.step}
              </span>

              {/* Title */}
              <h3 className="text-lg font-semibold text-foreground mb-2 leading-snug">
                {pillar.title}
              </h3>

              {/* Description */}
              <p className="text-sm text-muted-foreground leading-relaxed">
                {pillar.description}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
