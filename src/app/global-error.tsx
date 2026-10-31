"use client";

import React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#1C1C1C", color: "#fff", fontFamily: "sans-serif" }}>
        <main
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              maxWidth: 440,
              width: "100%",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 32,
              textAlign: "center",
              background: "#1E1E1E",
            }}
          >
            <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Subway Therapy is delayed.</h1>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 1.6 }}>
              The application could not start. Please refresh the page.
            </p>
            {error.digest && (
              <p style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 16,
                padding: "10px 18px",
                borderRadius: 8,
                border: 0,
                background: "#00933C",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
