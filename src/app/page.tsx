import type { Metadata } from "next";
import WallExperience from "@/components/WallExperience";
import { WallCamera } from "@/components/Wall";
import { getInitialWallNotes, getWallStats } from "@/lib/note-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

interface HomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseCamera(
  params: Record<string, string | string[] | undefined>
): WallCamera | undefined {
  const rawX = firstValue(params.x);
  const rawY = firstValue(params.y);
  if (rawX === undefined || rawY === undefined) return undefined;

  const x = Number(rawX);
  const y = Number(rawY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  const rawZoom = Number(firstValue(params.z));
  const zoom = Number.isFinite(rawZoom)
    ? Math.min(2, Math.max(0.25, rawZoom))
    : 1;

  return { x, y, zoom };
}

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const camera = parseCamera(params);

  const [initialNotes, initialStats] = await Promise.all([
    getInitialWallNotes().catch((error) => {
      console.error("Error loading initial wall notes:", error);
      return [];
    }),
    getWallStats().catch((error) => {
      console.error("Error loading wall stats:", error);
      return null;
    }),
  ]);

  return (
    <WallExperience
      initialNotes={initialNotes}
      initialStats={initialStats}
      initialCamera={camera}
    />
  );
}
