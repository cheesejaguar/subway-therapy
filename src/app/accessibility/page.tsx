import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Accessibility",
  description:
    "How Subway Therapy makes the wall usable with a keyboard, screen reader, reduced motion, and low vision, and how to report a barrier.",
  alternates: { canonical: "/accessibility" },
};

export default function AccessibilityPage() {
  return (
    <PageShell>
      <article className="content-prose max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="eyebrow">Accessibility</p>
        <h1>The wall should be readable by everyone.</h1>
        <p className="lede">
          A community wall only works if people can reach it. We aim to meet WCAG
          2.2 AA across the site and to keep improving where the wall metaphor
          makes access harder.
        </p>

        <h2>What is in place</h2>
        <ul>
          <li>A keyboard-navigable wall: arrow keys pan, plus and minus zoom, and 0 recenters.</li>
          <li>A searchable <strong>list view</strong> that presents loaded notes as plain, semantic text.</li>
          <li>A full <a href="/gallery">gallery</a> that works without the canvas-like wall.</li>
          <li>Visible focus styles and a skip link on every page.</li>
          <li>Reduced-motion support that shortens or removes decorative animation.</li>
          <li>Text notes rendered as real text, not images, so they can be selected, translated, and read by assistive technology.</li>
          <li>Optional descriptions for drawn notes, shown to screen reader users and in the gallery.</li>
          <li>High-contrast support for the station chrome and note outlines.</li>
          <li>Touch targets sized for comfortable use on phones.</li>
        </ul>

        <h2>Known limitations</h2>
        <p>
          The wall is a large, pannable canvas. Screen reader users may find the
          list view or gallery faster than exploring the wall spatially. Drawn
          notes are inherently visual; if the author did not provide a
          description, the wall can only announce that a drawing exists. We are
          continuing to improve descriptions and navigation.
        </p>

        <h2>Motion and sound</h2>
        <p>
          Animations respect <code>prefers-reduced-motion</code>. Ambient sound is
          off by default and only starts when you choose it from the wall menu.
        </p>

        <h2>Feedback</h2>
        <p>
          If something on this site is difficult or impossible to use, tell us
          what happened and what would help. Email{" "}
          <a href="mailto:hello@subwaytherapy.net">hello@subwaytherapy.net</a> with
          “Accessibility” in the subject line. We will try to respond within a
          reasonable time and will prioritize barriers that block participation.
        </p>
      </article>
    </PageShell>
  );
}
