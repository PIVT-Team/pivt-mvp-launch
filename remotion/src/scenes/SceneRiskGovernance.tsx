import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, SceneFrame, palette } from "../components/SceneFrame";

export const SceneRiskGovernance: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tickerPop = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 190 } });
  const profileIn = spring({ frame: frame - 48, fps, config: { damping: 18, stiffness: 160 } });
  const uploadIn = spring({ frame: frame - 92, fps, config: { damping: 18, stiffness: 170 } });
  const checkProgress = interpolate(frame, [110, 170], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const clearState = frame > 188;

  return (
    <SceneFrame>
      <AbsoluteFill style={{ padding: 88 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 3, color: 'rgba(255,255,255,0.64)', marginBottom: 14 }}>PIVT Demo · Scene 3</div>
            <div style={{ fontSize: 60, lineHeight: 1.04, fontWeight: 700, maxWidth: 980 }}>Risk, governance, and compliance stay in the same operating flow.</div>
          </div>
          <Img src={staticFile('pivt-logo.png')} style={{ width: 156, opacity: 0.92 }} />
        </div>

        <div
          style={{
            opacity: tickerPop,
            transform: `scale(${interpolate(tickerPop, [0, 1], [0.96, 1])})`,
            marginBottom: 20,
            padding: '16px 20px',
            borderRadius: 999,
            background: clearState ? 'rgba(31,157,98,0.15)' : 'rgba(212,74,91,0.15)',
            border: clearState ? '1px solid rgba(31,157,98,0.35)' : '1px solid rgba(212,74,91,0.38)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 16,
            color: '#fff',
          }}
        >
          <div style={{ width: 14, height: 14, borderRadius: 999, background: clearState ? palette.success : palette.danger }} />
          <div style={{ fontSize: 24, fontWeight: 700 }}>{clearState ? 'Cleared' : 'Blocker'}</div>
          <div style={{ fontSize: 22, opacity: 0.92 }}>{clearState ? 'KYC Cleared: GIC Private Limited' : 'KYC Failed: GIC Private Limited'}</div>
          <div style={{ fontSize: 18, opacity: 0.7 }}>Risk Monitor · Global</div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 26 }}>
          <div
            style={{
              opacity: profileIn,
              transform: `translateX(${interpolate(profileIn, [0, 1], [-30, 0])}px)`,
              borderRadius: 30,
              background: 'rgba(250,250,255,0.96)',
              padding: 28,
              boxShadow: '0 30px 80px rgba(5, 10, 20, 0.24)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 18, color: palette.subtext, marginBottom: 8 }}>Stakeholder Profile</div>
                <div style={{ fontSize: 38, color: palette.text, fontWeight: 700 }}>GIC Private Limited</div>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: 999, background: clearState ? palette.successSoft : palette.dangerSoft, color: clearState ? palette.success : palette.danger, fontWeight: 700 }}>
                {clearState ? 'Cleared' : 'Failed'}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
              {[
                ['Entity type', 'Investor'],
                ['Jurisdiction', 'Singapore'],
                ['Ownership', '18.4%'],
                ['Review owner', 'Compliance Ops'],
              ].map(([k, v]) => (
                <div key={k} style={{ padding: '18px 20px', borderRadius: 18, background: 'rgba(15,23,42,0.05)' }}>
                  <div style={{ fontSize: 14, color: palette.subtext, marginBottom: 8 }}>{k}</div>
                  <div style={{ fontSize: 24, color: palette.text, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 24, borderRadius: 24, border: `1px solid ${palette.line}`, background: 'rgba(107,92,255,0.05)' }}>
              <div style={{ fontSize: 16, color: palette.subtext, marginBottom: 14 }}>Compliance Check</div>
              <div style={{ height: 16, borderRadius: 999, background: 'rgba(15,23,42,0.08)', overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ width: `${checkProgress}%`, height: '100%', background: clearState ? 'linear-gradient(90deg, #1f9d62, #60a5fa)' : 'linear-gradient(90deg, #d44a5b, #e5a624)' }} />
              </div>
              <div style={{ fontSize: 26, color: palette.text, fontWeight: 700 }}>{clearState ? 'Beneficial ownership validated' : 'Running refreshed sanctions and ownership review'}</div>
            </div>
          </div>

          <div
            style={{
              opacity: uploadIn,
              transform: `translateX(${interpolate(uploadIn, [0, 1], [34, 0])}px)`,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div style={{ borderRadius: 28, background: 'rgba(16,18,34,0.88)', border: '1px solid rgba(255,255,255,0.08)', padding: 28 }}>
              <div style={{ fontSize: 16, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Remediation</div>
              <div style={{ padding: 22, borderRadius: 22, background: 'rgba(255,255,255,0.06)', marginBottom: 16 }}>
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Beneficial Ownership.pdf</div>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.64)' }}>Uploaded to cure prior KYC failure</div>
              </div>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>PIVT immediately reruns checks, records the result, and updates downstream readiness automatically.</div>
            </div>

            <div style={{ borderRadius: 28, background: 'rgba(250,250,255,0.96)', padding: 26, boxShadow: '0 30px 80px rgba(5, 10, 20, 0.24)' }}>
              <div style={{ fontSize: 16, color: palette.subtext, marginBottom: 10 }}>Deal Readiness</div>
              <div style={{ fontSize: 84, color: palette.text, fontWeight: 700, lineHeight: 1 }}>100%</div>
              <div style={{ marginTop: 12, fontSize: 24, fontWeight: 600, color: palette.success }}>Execution gate unlocked</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Caption text="Resolve blockers in real-time." />
    </SceneFrame>
  );
};
