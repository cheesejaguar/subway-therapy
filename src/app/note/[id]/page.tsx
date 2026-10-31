import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import NotePageClient from "@/components/NotePageClient";
import { getApprovedNoteById } from "@/lib/note-service";
import { type NoteKind, getNoteKind, getNoteText } from "@/lib/types";
import { validateNoteId } from "@/lib/validation";

export const dynamic = "force-dynamic";

interface NotePageProps {
  params: Promise<{ id: string }>;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subwaytherapy.net";

function noteDescription(note: {
  text?: string;
  altText?: string;
  caption?: string;
  kind?: NoteKind;
}): string {
  const text = getNoteText(note);
  if (getNoteKind(note) === "text" && text) {
    return text.length > 200 ? `${text.slice(0, 197)}…` : text;
  }
  return (
    note.altText?.trim() ||
    note.caption?.trim() ||
    "A hand-drawn note on the Subway Therapy wall."
  );
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const { id } = await params;
  const validated = validateNoteId(id);
  if (!validated.ok) return { title: "Note not found" };

  const note = await getApprovedNoteById(validated.value).catch(() => null);
  if (!note) return { title: "Note not found" };

  const description = noteDescription(note);
  const title = description.length > 60 ? `${description.slice(0, 57)}…` : description;
  const url = `${siteUrl}/note/${note.id}`;
  const image = `${siteUrl}/api/og?noteId=${note.id}&format=wide`;

  return {
    title,
    description,
    alternates: { canonical: `/note/${note.id}` },
    openGraph: {
      type: "article",
      url,
      title: "A note on Subway Therapy",
      description,
      images: [{ url: image, width: 1200, height: 630, alt: description }],
    },
    twitter: {
      card: "summary_large_image",
      title: "A note on Subway Therapy",
      description,
      images: [image],
    },
  };
}

export default async function NotePage({ params }: NotePageProps) {
  const { id } = await params;
  const validated = validateNoteId(id);
  if (!validated.ok) notFound();

  const note = await getApprovedNoteById(validated.value).catch(() => null);
  if (!note) notFound();

  return (
    <PageShell>
      <NotePageClient note={note} />
    </PageShell>
  );
}
