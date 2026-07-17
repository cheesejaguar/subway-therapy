import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Subway Therapy",
    short_name: "Subway Therapy",
    description:
      "Leave a note on the virtual subway wall. Draw or type your message and share your thoughts with the world.",
    start_url: "/",
    display: "standalone",
    background_color: "#1C1C1C",
    theme_color: "#1C1C1C",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
