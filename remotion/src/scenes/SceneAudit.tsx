import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, SceneFrame, palette } from "../components/SceneFrame";

const events = [
  ['09:01:12', 'Joanna Chen', 'Merger Agreement uploaded'],
  ['09:01:15', 'Newton AI', 'Commercial terms extracted'],
  ['09:07:44', 'Compliance Ops', 'Beneficial ownership document uploaded'],
  ['09:08:02', 'System', 'KYC cleared for GIC Private Limited'],
  ['09:13:26', 'Legal Reviewer', 'Final approval granted'],
  ['09:14:11', 'Treasury Ops', 'Wire pack generated'],
  ['09:14:35', 'System', 'Wire executed · $185M'],
];

export const SceneAudit: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const panelIn = spring({ frame, fps, config: { damping: 18, stiffness: 160 } });
  const logoIn = spring({ frame: frame - 138, fps, config: { damping: 18, stiffness: 170 } });
  const scrollY = interpolate(frame, [44, 154], [0, -210], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const panelOpacity = interpolate(frame, [0, 180, 220], [1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const captionOpacity = interpolate(frame, [0, 150, 190], [1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <SceneFrame>
      <AbsoluteFill style={{ padding: 88 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30, opacity: panelOpacity }}>
          <div>
            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 3, color: 'rgba(255,255,255,0.64)', marginBottom: 14 }}>PIVT Demo · Scene 5</div>
            <div style={{ fontSize: 60, lineHeight: 1.04, fontWeight: 700, maxWidth: 940 }}>Every action is preserved in an immutable closing record.</div>
          </div>
        </div>

        <div
          style={{
            opacity: panelIn * panelOpacity,
            transform: `translateY(${interpolate(panelIn, [0, 1], [24, 0])}px)`,
            borderRadius: 30,
            background: 'rgba(250,250,255,0.96)',
            padding: 28,
            boxShadow: '0 30px 80px rgba(5, 10, 20, 0.24)',
            height: 650,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 18, color: palette.subtext, marginBottom: 8 }}>Audit Log</div>
              <div style={{ fontSize: 40, color: palette.text, fontWeight: 700 }}>Closing activity chain</div>
            </div>
            <div style={{ padding: '10px 16px', borderRadius: 999, background: 'rgba(15,23,42,0.06)', color: palette.text, fontWeight: 600 }}>Append-only</div>
          </div>

          <div style={{ display: 'grid', gap: 14, transform: `translateY(${scrollY}px)` }}>
            {events.map(([time, actor, action], index) => (
              <div key={time + action} style={{ display: 'grid', gridTemplateColumns: '180px 240px 1fr', gap: 18, alignItems: 'center', padding: '18px 20px', borderRadius: 20, background: index === events.length - 1 ? 'rgba(31,157,98,0.12)' : 'rgba(15,23,42,0.04)', border: `1px solid ${palette.line}` }}>
                <div style={{ fontSize: 22, color: palette.text, fontFamily: '"JetBrains Mono", monospace', fontWeight: 600 }}>{time}</div>
                <div style={{ fontSize: 22, color: palette.text, fontWeight: 600 }}>{actor}</div>
                <div style={{ fontSize: 24, color: palette.text }}>{action}</div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            opacity: interpolate(logoIn, [0, 1], [0, 1]),
            transform: `scale(${interpolate(logoIn, [0, 1], [0.92, 1])})`,
          }}
        >
          <Img src={staticFile('pivt-logo.png')} style={{ width: 260, marginBottom: 28 }} />
          <div style={{ fontSize: 46, fontWeight: 700, color: '#fff', textAlign: 'center', maxWidth: 860, lineHeight: 1.15 }}>
            The intelligence layer behind every close.
          </div>
        </div>
      </AbsoluteFill>
      <div style={{ opacity: captionOpacity }}>
        <Caption text="PIVT. The intelligence layer behind every close." />
      </div>
    </SceneFrame>
  );
};
