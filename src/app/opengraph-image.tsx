import { ImageResponse } from "next/og";

// Social preview card (Open Graph / Twitter). Generated as a PNG because
// most platforms do not render SVG og:images.
export const alt = "Subway Therapy — leave a note on the virtual subway wall";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NOTES = [
  { color: "#fff740", rotate: "-4deg", text: "you are not alone" },
  { color: "#ff7eb9", rotate: "2deg", text: "breathe" },
  { color: "#7afcff", rotate: "-2deg", text: "we're in this together" },
  { color: "#7aff92", rotate: "3deg", text: "keep going" },
];

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1C1C1C",
        }}
      >
        {/* Subway line stripe */}
        <div style={{ display: "flex", height: 14 }}>
          {["#EE352E", "#FF6319", "#FCCC0A", "#00933C", "#0039A6", "#B933AD"].map(
            (color) => (
              <div key={color} style={{ flex: 1, backgroundColor: color }} />
            )
          )}
        </div>

        {/* Tiled wall band with sticky notes */}
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            gap: 28,
            backgroundColor: "#F0EDE5",
            backgroundImage:
              "linear-gradient(to bottom, #C8C3B8 2px, transparent 2px), linear-gradient(90deg, #C8C3B8 2px, transparent 2px)",
            backgroundSize: "110px 110px",
          }}
        >
          {NOTES.map((note) => (
            <div
              key={note.text}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 190,
                height: 190,
                padding: 18,
                backgroundColor: note.color,
                transform: `rotate(${note.rotate})`,
                boxShadow: "4px 6px 18px rgba(0,0,0,0.25)",
                fontSize: 30,
                fontWeight: 600,
                color: "#1a1a1a",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {note.text}
            </div>
          ))}
        </div>

        {/* MTA-style sign footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "36px 64px",
            backgroundColor: "#000000",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {["S", "T"].map((letter) => (
              <div
                key={letter}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 84,
                  height: 84,
                  borderRadius: 84,
                  backgroundColor: "#00933C",
                  color: "#FFFFFF",
                  fontSize: 52,
                  fontWeight: 800,
                }}
              >
                {letter}
              </div>
            ))}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: 12 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 64,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: 2,
                }}
              >
                SUBWAY THERAPY
              </div>
              <div style={{ display: "flex", fontSize: 28, color: "rgba(255,255,255,0.65)" }}>
                Leave a note on the virtual subway wall
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: 1,
            }}
          >
            subwaytherapy.net
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
