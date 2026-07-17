import { ImageResponse } from "next/og";

// iOS home-screen icon: full-bleed (no transparency), 180x180.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#1C1C1C",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 128,
            height: 128,
            backgroundColor: "#fff740",
            transform: "rotate(-5deg)",
            boxShadow: "4px 6px 16px rgba(0,0,0,0.45)",
            fontSize: 72,
            fontWeight: 800,
            color: "#1a1a1a",
          }}
        >
          ST
        </div>
      </div>
    ),
    { ...size }
  );
}
