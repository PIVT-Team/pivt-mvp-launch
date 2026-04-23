import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption, SceneFrame, palette } from "../components/SceneFrame";

const StatCard: React.FC<{ label: string; value: string; delay: number }> = ({ label, value, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - delay, fps, config: { damping: 18, stiffness: 180 } });
  return (
    <div
      style={{
        opacity: reveal,
        transform: `translateY(${interpolate(reveal, [0, 1], [18, 0])}px)`,
        padding: '18px 20px',
        borderRadius: 18,
        background: 'rgba(255,255,255,0.88)',
        border: `1px solid ${palette.line}`,
        minWidth: 208,
      }}
    >
      <div style={{ fontSize: 14, color: palette.subtext, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: palette.text }}>{value}</div>
    </div>
  );
};

export const SceneIngestion: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const modalIn = spring({ frame, fps, config: { damping: 16, stiffness: 140 } });
  const panelIn = spring({ frame: frame - 28, fps, config: { damping: 18, stiffness: 160 } });
  const docDrop = spring({ frame: frame - 10, fps, config: { damping: 20, stiffness: 180 } });
  const scanLine = interpolate(frame, [40, 92], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const logoFade = interpolate(frame, [0, 24], [0.5, 1], { extrapolateRight: 'clamp' });

  return (
    <SceneFrame>
      <AbsoluteFill style={{ padding: 88 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 44 }}>
          <div>
            <div style={{ fontSize: 18, textTransform: 'uppercase', letterSpacing: 3, color: 'rgba(255,255,255,0.64)', marginBottom: 18 }}>PIVT Demo · Scene 1</div>
            <div style={{ fontSize: 64, lineHeight: 1.02, fontWeight: 700, maxWidth: 760 }}>From intake to structured deal context in seconds.</div>
          </div>
          <Img src={staticFile('pivt-logo.png')} style={{ width: 168, opacity: logoFade }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 28, flex: 1 }}>
          <div
            style={{
              opacity: modalIn,
              transform: `translateY(${interpolate(modalIn, [0, 1], [38, 0])}px) scale(${interpolate(modalIn, [0, 1], [0.96, 1])})`,
              borderRadius: 30,
              background: palette.panel,
              padding: 34,
              boxShadow: '0 30px 80px rgba(5, 10, 20, 0.22)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }}>
              <div>
                <div style={{ fontSize: 18, color: palette.subtext, marginBottom: 8 }}>New Deal</div>
                <div style={{ fontSize: 40, color: palette.text, fontWeight: 700 }}>Project ATLAS</div>
              </div>
              <div style={{ fontSize: 15, color: palette.subtext, padding: '10px 14px', borderRadius: 999, background: 'rgba(107,92,255,0.08)' }}>Draft</div>
            </div>

            <div
              style={{
                position: 'relative',
                flex: 1,
                borderRadius: 28,
                border: `2px dashed rgba(107,92,255,0.28)`,
                background: 'linear-gradient(180deg, rgba(107,92,255,0.06), rgba(96,165,250,0.05))',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              <div style={{ textAlign: 'center', color: palette.subtext }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: palette.text, marginBottom: 10 }}>Drop merger agreement</div>
                <div style={{ fontSize: 18 }}>Upload core documents to start orchestration</div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: interpolate(docDrop, [0, 1], [-180, 152]),
                  left: 92,
                  right: 92,
                  padding: '22px 24px',
                  borderRadius: 20,
                  background: '#ffffff',
                  border: `1px solid ${palette.line}`,
                  boxShadow: '0 20px 36px rgba(16,24,40,0.14)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: palette.text }}>Merger Agreement.pdf</div>
                  <div style={{ fontSize: 15, color: palette.subtext, marginTop: 6 }}>12.4 MB · Uploaded by Joanna Chen</div>
                </div>
                <div style={{ padding: '10px 14px', borderRadius: 999, background: 'rgba(31,157,98,0.12)', color: palette.success, fontWeight: 600 }}>Scanning</div>
              </div>
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 160,
                  left: interpolate(scanLine, [0, 1], [-180, 700]),
                  background: 'linear-gradient(90deg, rgba(107,92,255,0), rgba(107,92,255,0.18), rgba(96,165,250,0.1), rgba(107,92,255,0))',
                  filter: 'blur(6px)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              opacity: panelIn,
              transform: `translateX(${interpolate(panelIn, [0, 1], [50, 0])}px)`,
              borderRadius: 30,
              background: 'rgba(16,18,34,0.88)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: 30,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 30px 90px rgba(0,0,0,0.3)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <div style={{ width: 42, height: 42, borderRadius: 16, background: 'linear-gradient(135deg, #6b5cff, #60a5fa)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 18, fontWeight: 700 }}>N</div>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 700 }}>Newton AI</div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.64)' }}>Deal intake assistant</div>
                </div>
              </div>

              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: 24 }}>
                Parsing agreement, extracting key commercial terms, and seeding the workspace.
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <StatCard label="Deal Value" value="$185M" delay={42} />
                <StatCard label="Closing Date" value="Mar 15" delay={56} />
                <StatCard label="Parties" value="3" delay={70} />
              </div>
            </div>

            <div style={{ marginTop: 26, padding: 18, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 2, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>Live extraction</div>
              <div style={{ fontSize: 24, fontWeight: 600 }}>Deal structure synchronized to PIVT</div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <Caption text="AI extracts the deal instantly." />
    </SceneFrame>
  );
};
