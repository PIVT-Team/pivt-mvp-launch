/**
 * PIVT Animation System - Spring Physics
 */

export const springConfig = {
  standard: { type: 'spring' as const, stiffness: 300, damping: 30, mass: 1 },
  heavy: { type: 'spring' as const, stiffness: 200, damping: 25, mass: 1.5 },
  snapBack: { type: 'spring' as const, stiffness: 500, damping: 35, mass: 0.8 },
  lock: { type: 'spring' as const, stiffness: 400, damping: 40, mass: 1 },
  modeTransition: { type: 'spring' as const, stiffness: 250, damping: 28, mass: 1.2 },
  reveal: { type: 'spring' as const, stiffness: 350, damping: 32, mass: 0.9 },
};

export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: springConfig.standard,
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: springConfig.standard,
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: springConfig.standard,
};

export const slideInRight = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 40 },
  transition: springConfig.standard,
};

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.05 } },
};
