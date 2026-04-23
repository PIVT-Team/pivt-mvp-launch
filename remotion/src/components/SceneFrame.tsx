import React from "react";
import { AbsoluteFill } from "remotion";

type Props = {
  children: React.ReactNode;
};

export const palette = {
  bg: "#0f1020",
  bgSoft: "#171a32",
  panel: "rgba(255,255,255,0.92)",
  panelSoft: "rgba(248,248,255,0.72)",
  line: "rgba(108, 86, 255, 0.16)",
  text: "#111827",
  subtext: "#5b6475",
  accent: "#6b5cff",
  accentAlt: "#60a5fa",
  success: "#1f9d62",
  successSoft: "rgba(31,157,98,0.14)",
  warning: "#e5a624",
  warningSoft: "rgba(229,166,36,0.14)",
  danger: "#d44a5b",
  dangerSoft: "rgba(212,74,91,0.14)",
  white: "#ffffff",
};

export const SceneFrame: React.FC<Props> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 18% 12%, rgba(107,92,255,0.22), transparent 34%),
          radial-gradient(circle at 88% 10%, rgba(96,165,250,0.18), transparent 30%),
          linear-gradient(180deg, ${palette.bgSoft} 0%, ${palette.bg} 100%)`,
        fontFamily: 'Inter, system-ui, sans-serif',
        color: palette.white,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          opacity: 0.28,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 28,
          borderRadius: 36,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
          boxShadow: '0 40px 120px rgba(0,0,0,0.28)',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const Caption: React.FC<{ text: string }> = ({ text }) => (
  <div
    style={{
      position: 'absolute',
      left: 88,
      bottom: 70,
      padding: '16px 24px',
      borderRadius: 18,
      background: 'rgba(17,24,39,0.72)',
      border: '1px solid rgba(255,255,255,0.08)',
      color: palette.white,
      fontSize: 30,
      fontWeight: 600,
      letterSpacing: 0,
      boxShadow: '0 18px 48px rgba(0,0,0,0.28)',
    }}
  >
    {text}
  </div>
);
