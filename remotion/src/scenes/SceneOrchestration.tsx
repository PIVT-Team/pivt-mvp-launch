import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, SceneFrame, palette } from "../components/SceneFrame";

const ChecklistColumn: React.FC<{ title: string; items: string[]; start: number }> = ({ title, items, start }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inView = spring({ frame: frame - start, fps, config: { damping: 18, stiffness: 180 } });
  return (
    <div
      style={{
        opacity: inView,
        transform: `translateY(${interpolate(inView, [0, 1], [20, 0])}px)`,
        padding: 22,
        borderRadius: 24,
        background: 'rgba(255,255,255,0.92)',
        border: `1px solid ${palette.line}`,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, color: palette.text, marginBottom: 18 }}>{title}</div>
      <div style={{ display: 'grid', gap: 12 }}>
        {items.map((item, index) => {
          const ready = frame > start + 20 + index * 10;
          return (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16, background: ready ? palette.successSoft : 'rgba(15,23,42,0.05)' }}>
              <div style={{ width: 14, height: 14, borderRadius: 999, background: ready ? palette.success : 'rgba(107,114,128,0.4)' }} />
              <div style={{ fontSize: 16, color: palette.text, fontWeight: 500 }}>{item}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SceneOrchestration: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shellIn = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const progress = interpolate(frame, [0, 220], [42, 96], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });

  return (
    <SceneFrame>
      <AbsoluteFill style={{ padding: 88 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 3, color: 'rgba(255,255,255,0.64)', marginBottom: 14 }}>PIVT Demo · Scene 2</div>
            <div style={{ fontSize: 60, lineHeight: 1.04, fontWeight: 700 }}>The control room for every workstream.</div>
          </div>
          <Img src={staticFile('pivt-logo.png')} style={{ width: 156, opacity: 0.92 }} />
        </div>

        <div
          style={{
            opacity: shellIn,
            transform: `translateY(${interpolate(shellIn, [0, 1], [26, 0])}px)`,
            flex: 1,
            borderRadius: 30,
            background: 'rgba(250,250,255,0.96)',
            padding: 28,
            boxShadow: '0 30px 80px rgba(5, 10, 20, 0.24)',
            display: 'grid',
            gridTemplateColumns: '340px 1fr',
            gap: 24,
          }}
        >
          <div style={{ borderRadius: 24, background: 'rgba(15,23,42,0.03)', padding: 24, border: `1px solid ${palette.line}` }}>
            <div style={{ fontSize: 18, color: palette.subtext, marginBottom: 8 }}>Deal Dashboard</div>
            <div style={{ fontSize: 40, fontWeight: 700, color: palette.text, marginBottom: 24 }}>Project ATLAS</div>
            <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 2, color: palette.subtext, marginBottom: 12 }}>Readiness Score</div>
            <div style={{ fontSize: 88, fontWeight: 700, color: palette.text, lineHeight: 1 }}>{Math.round(progress)}%</div>
            <div style={{ marginTop: 18, height: 16, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #6b5cff, #60a5fa)' }} />
            </div>
            <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>
              {[
                ['Documents linked', '11 / 12'],
                ['Conditions cleared', frame > 140 ? '9 / 10' : '4 / 10'],
                ['Approvals granted', frame > 170 ? '6 / 6' : '2 / 6'],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                  <span style={{ color: palette.subtext }}>{label}</span>
                  <span style={{ color: palette.text, fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            <ChecklistColumn title="Legal" items={["SPA uploaded", "Signature packet", "Disclosure schedules"]} start={22} />
            <ChecklistColumn title="Financial" items={["Waterfall modeled", "Wire instructions", "Escrow setup"]} start={34} />
            <ChecklistColumn title="Regulatory" items={["HSR intake", "KYC / KYB", "Sanctions screening"]} start={46} />
            <ChecklistColumn title="Technical" items={["Data room sync", "API dispatch route", "Audit chain"]} start={58} />
          </div>
        </div>
      </AbsoluteFill>
      <Caption text="Orchestrate every requirement." />
    </SceneFrame>
  );
};
