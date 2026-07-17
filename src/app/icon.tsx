import { ImageResponse } from "next/og";

// App icon: a yellow sticky note with a scribble, on the station-dark
// background. Referenced by the web manifest and used as the favicon for
// browsers that prefer PNG.
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 96,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 360,
            height: 360,
            backgroundColor: "#fff740",
            transform: "rotate(-5deg)",
            boxShadow: "10px 14px 40px rgba(0,0,0,0.45)",
            fontSize: 200,
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
