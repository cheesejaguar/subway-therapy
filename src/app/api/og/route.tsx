import { ImageResponse } from "next/og";
import QRCode from "qrcode";
import { getApprovedNoteById } from "@/lib/note-service";
import {
  NOTE_COLORS,
  getNoteKind,
  getNoteText,
  getReactionTotal,
} from "@/lib/types";

export const runtime = "nodejs";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subwaytherapy.net";

const FORMATS = {
  wide: { width: 1200, height: 630 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
} as const;

type Format = keyof typeof FORMATS;

function isFormat(value: string | null): value is Format {
  return value === "wide" || value === "square" || value === "story";
}

async function imageDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const response = await fetch(url, { cache: "force-cache" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("noteId");
  const formatParam = searchParams.get("format");
  const format: Format = isFormat(formatParam) ? formatParam : "wide";
  const note = id ? await getApprovedNoteById(id) : null;
  const noteUrl = note ? `${siteUrl}/note/${note.id}` : siteUrl;
  const qr = await QRCode.toDataURL(noteUrl, {
    margin: 1,
    width: format === "story" ? 220 : 150,
    color: { dark: "#1C1C1C", light: "#FFFFFF" },
  });

  const isStory = format === "story";
  const isSquare = format === "square";
  const noteColor = note ? NOTE_COLORS[note.color] ?? NOTE_COLORS.yellow : "#fff740";
  const text = note ? getNoteText(note) : "";
  const isText = note ? getNoteKind(note) === "text" : false;
  const drawing = note && !isText ? await imageDataUrl(note.imageUrl) : null;
  const reactions = note ? getReactionTotal(note) : 0;
  const textSize = text.length > 180 ? 42 : text.length > 100 ? 52 : isStory ? 64 : 58;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#1C1C1C",
          padding: isStory ? 64 : 44,
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            height: 12,
            width: "100%",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {["#EE352E", "#FF6319", "#FCCC0A", "#00933C", "#0039A6", "#B933AD"].map(
            (color) => (
              <div key={color} style={{ flex: 1, backgroundColor: color }} />
            )
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: isStory ? 78 : 58,
                height: isStory ? 78 : 58,
                borderRadius: 999,
                backgroundColor: "#00933C",
                color: "#fff",
                fontSize: isStory ? 34 : 26,
                fontWeight: 800,
              }}
            >
              ST
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ color: "#fff", fontSize: isStory ? 36 : 28, fontWeight: 700 }}>
                SUBWAY THERAPY
              </div>
              <div style={{ color: "rgba(255,255,255,0.6)", fontSize: isStory ? 22 : 17 }}>
                A virtual wall for what we carry
              </div>
            </div>
          </div>
          {!isStory && (
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 16 }}>
              {reactions > 0 ? `${reactions} reactions` : "subwaytherapy.net"}
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            margin: isStory ? "48px 0" : "28px 0",
          }}
        >
          {note ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: noteColor,
                width: isStory ? 840 : isSquare ? 780 : 690,
                height: isStory ? 840 : isSquare ? 780 : 470,
                padding: isStory ? 64 : 44,
                transform: "rotate(-2deg)",
                boxShadow: "12px 18px 40px rgba(0,0,0,0.45)",
              }}
            >
              {isText ? (
                <div
                  style={{
                    color: "#1A1A1A",
                    fontSize: textSize,
                    lineHeight: 1.2,
                    textAlign: "center",
                    fontWeight: 600,
                    maxHeight: "100%",
                    overflow: "hidden",
                  }}
                >
                  {text}
                </div>
              ) : drawing ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={drawing}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <div
                  style={{
                    color: "#1A1A1A",
                    fontSize: 34,
                    textAlign: "center",
                    fontWeight: 600,
                  }}
                >
                  A note on the wall
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
                color: "#fff",
              }}
            >
              <div style={{ fontSize: isStory ? 90 : 72, fontWeight: 800, textAlign: "center" }}>
                LEAVE A NOTE.
              </div>
              <div style={{ fontSize: isStory ? 34 : 28, color: "rgba(255,255,255,0.65)", textAlign: "center" }}>
                For a stranger, for yourself, for someone you miss.
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: "#fff", fontSize: isStory ? 30 : 22, fontWeight: 600 }}>
              {note ? "Read this note. Leave your own." : "One thousand feet of notes."}
            </div>
            <div style={{ color: "rgba(255,255,255,0.55)", fontSize: isStory ? 22 : 16 }}>
              {noteUrl.replace(/^https?:\/\//, "")}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt=""
            style={{
              width: isStory ? 190 : 128,
              height: isStory ? 190 : 128,
              backgroundColor: "#fff",
              padding: 8,
            }}
          />
        </div>
      </div>
    ),
    {
      ...FORMATS[format],
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  );
}
