import type { MetadataRoute } from "next";
import { getGalleryNotes } from "@/lib/note-service";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subwaytherapy.net";

export const revalidate = 3600;

const STATIC_PAGES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/gallery", priority: 0.9, changeFrequency: "daily" },
  { path: "/host", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/guidelines", priority: 0.5, changeFrequency: "monthly" },
  { path: "/accessibility", priority: 0.4, changeFrequency: "monthly" },
  { path: "/press", priority: 0.4, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    // Keep the root canonical without a trailing slash, matching metadata.
    url: page.path === "/" ? siteUrl : `${siteUrl}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  try {
    const notes = await getGalleryNotes({ limit: 100 });
    const noteEntries: MetadataRoute.Sitemap = notes.map((note) => ({
      url: `${siteUrl}/note/${note.id}`,
      lastModified: new Date(note.createdAt),
      changeFrequency: "yearly",
      priority: 0.6,
    }));
    return [...staticEntries, ...noteEntries];
  } catch {
    return staticEntries;
  }
}
