import { ImageResponse } from "next/og";

export const alt = "Gauntlet: break your voice agent before your customers do";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK = ["01110", "10000", "10111", "10001", "01110"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#141211",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 2px, transparent 2px)",
          backgroundSize: "28px 28px",
          color: "#f6f5f2",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {MARK.map((row, y) => (
              <div key={y} style={{ display: "flex", gap: 6 }}>
                {[...row].map((c, x) => (
                  <div
                    key={x}
                    style={{ width: 10, height: 10, borderRadius: 10, background: c === "1" ? "#55c8e6" : "#3a3633" }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 44, letterSpacing: 2, fontFamily: "monospace" }}>gauntlet</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05, maxWidth: 980 }}>
            Break your voice agent before your customers do.
          </div>
          <div style={{ fontSize: 30, color: "#b3aca5" }}>
            Synthetic callers · realistic speech-to-text noise · evidence-based judging
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 26, fontFamily: "monospace" }}>
          <span style={{ color: "#b3aca5" }}>said</span>
          <span style={{ color: "#f0607a", textDecoration: "line-through" }}>fifteen</span>
          <span style={{ color: "#b3aca5" }}>→ heard</span>
          <span style={{ color: "#55c8e6" }}>fifty</span>
        </div>
      </div>
    ),
    size,
  );
}
