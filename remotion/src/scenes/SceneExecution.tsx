import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, SceneFrame, palette } from "../components/SceneFrame";

export const SceneExecution: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shellIn = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const lockLift = spring({ frame: frame - 32, fps, config: { damping: 18, stiffness: 190 } });
  const progress = interpolate(frame, [110, 190], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const executed = frame > 198;

  return (
    <SceneFrame>
      <AbsoluteFill style={{ padding: 88 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 }}>
          <div>
            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 3, color: 'rgba(255,255,255,0.64)', marginBottom: 14 }}>PIVT Demo · Scene 4</div>
            <div style={{ fontSize: 60, lineHeight: 1.04, fontWeight: 700, maxWidth: 980 }}>Execution happens only after every upstream condition is cleared.</div>
          </div>
          <Img src={staticFile('pivt-logo.png')} style={{ width: 156, opacity: 0.92 }} />
        </div>

        <div
          style={{
            opacity: shellIn,
            transform: `translateY(${interpolate(shellIn, [0, 1], [24, 0])}px)`,
            flex: 1,
            borderRadius: 30,
            background: 'rgba(250,250,255,0.96)',
            padding: 28,
            boxShadow: '0 30px 80px rgba(5, 10, 20, 0.24)',
            display: 'grid',
            gridTemplateColumns: '0.95fr 1.05fr',
            gap: 24,
          }}
        >
          <div style={{ borderRadius: 24, background: 'rgba(15,23,42,0.03)', padding: 24, border: `1px solid ${palette.line}` }}>
            <div style={{ fontSize: 18, color: palette.subtext, marginBottom: 8 }}>Execution Tab</div>
            <div style={{ fontSize: 38, color: palette.text, fontWeight: 700, marginBottom: 24 }}>Execution Gate</div>

            <div style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
              {[
                'KYC / KYB complete',
                'Regulatory conditions cleared',
                'Approvals complete',
                'Wire instructions verified',
              ].map((item, index) => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 18, background: 'rgba(31,157,98,0.12)' }}>
                  <div style={{ width: 14, height: 14, borderRadius: 999, background: palette.success }} />
                  <div style={{ fontSize: 18, color: palette.text, fontWeight: 600 }}>{item}</div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 16, color: palette.subtext, marginBottom: 10 }}>Dispatch readiness</div>
            <div style={{ fontSize: 76, color: palette.text, fontWeight: 700, lineHeight: 1 }}>{Math.round(interpolate(frame, [0, 120], [76, 100], { extrapolateRight: 'clamp' }))}%</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ borderRadius: 24, background: 'rgba(16,18,34,0.88)', border: '1px solid rgba(255,255,255,0.08)', padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Final action</div>
                  <div style={{ fontSize: 30, fontWeight: 700 }}>Generate Wire Pack</div>
                </div>
                <div style={{ padding: '10px 16px', borderRadius: 999, background: lockLift > 0.88 ? 'rgba(31,157,98,0.15)' : 'rgba(255,255,255,0.08)', color: lockLift > 0.88 ? '#7ef0b5' : 'rgba(255,255,255,0.72)', fontWeight: 700 }}>
                  {lockLift > 0.88 ? 'Ready' : 'Locked'}
                </div>
              </div>

              <div
                style={{
                  padding: '20px 24px',
                  borderRadius: 22,
                  background: lockLift > 0.88 ? 'linear-gradient(135deg, #1f9d62, #60a5fa)' : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                  fontSize: 28,
                  fontWeight: 700,
                  boxShadow: lockLift > 0.88 ? '0 20px 40px rgba(31,157,98,0.25)' : 'none',
                }}
              >
                {lockLift > 0.88 ? 'Generate Wire Pack' : 'Waiting on upstream conditions'}
              </div>
            </div>

            <div style={{ borderRadius: 24, background: 'rgba(250,250,255,0.96)', padding: 24, boxShadow: '0 30px 80px rgba(5, 10, 20, 0.18)' }}>
              <div style={{ fontSize: 16, color: palette.subtext, marginBottom: 12 }}>Dispatch progress</div>
              <div style={{ height: 18, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden', marginBottom: 18 }}>
                <div style={{ width: `${progress}%`, height: '100%', background: executed ? 'linear-gradient(90deg, #1f9d62, #60a5fa)' : 'linear-gradient(90deg, #6b5cff, #60a5fa)' }} />
              </div>
              <div style={{ fontSize: 42, fontWeight: 700, color: palette.text, marginBottom: 10 }}>{executed ? 'Wire Executed: $185M' : 'Packaging approvals, allocations, and beneficiary data'}</div>
              <div style={{ fontSize: 18, color: palette.subtext }}>Immutable confirmation records, payees, and settlement metadata captured in one audit-safe handoff.</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Caption text="Execute with total confidence." />
    </SceneFrame>
  );
};
