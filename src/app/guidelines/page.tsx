import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Community guidelines",
  description:
    "How Subway Therapy keeps a public wall safe: what belongs here, what does not, how moderation works, and where to find support.",
  alternates: { canonical: "/guidelines" },
};

export default function GuidelinesPage() {
  return (
    <PageShell>
      <article className="content-prose max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="eyebrow">Take care of each other</p>
        <h1>Community guidelines</h1>
        <p className="lede">
          This wall is for honesty, not harm. Most people arrive here carrying
          something. Please leave room for them.
        </p>

        <h2>What belongs here</h2>
        <ul>
          <li>Personal feelings, hopes, grief, gratitude, and small victories.</li>
          <li>Messages of support for strangers who might need them.</li>
          <li>Poetry, drawings, jokes, and quiet observations.</li>
          <li>Notes in any language. The interface is English, but the wall is not.</li>
        </ul>

        <h2>What does not</h2>
        <ul>
          <li>Hate speech, slurs, or content that dehumanizes a group of people.</li>
          <li>Threats, incitement, or encouragement of violence or self-harm.</li>
          <li>Harassment, bullying, or targeted abuse.</li>
          <li>Sexual content involving minors, or explicit sexual content.</li>
          <li>Personal information about yourself or anyone else: phone numbers, addresses, emails, workplace details, or identifying photos.</li>
          <li>Spam, advertising, scams, or repeated promotional links.</li>
          <li>Impersonation of another person or of the project.</li>
        </ul>

        <h2>Moderation</h2>
        <p>
          Notes are screened by automated moderation before they appear. A note
          may be approved automatically, held for human review, or rejected. If a
          note is rejected, it does not use up your daily note. Human moderators
          review reports and can remove notes at any time.
        </p>
        <p>
          Moderation is not perfect. If you see something harmful, use the report
          control on the note. Reports are anonymous and reviewed in batches.
        </p>

        <h2>Anonymity is not invisibility</h2>
        <p>
          You do not need an account, but this is a public space. Do not post
          anything you would not want a stranger to read. We collect limited
          technical information to prevent abuse and keep the wall online; see the{" "}
          <a href="/privacy">privacy notice</a> for details.
        </p>

        <h2>If you are struggling</h2>
        <p>
          A note on a wall is not a substitute for care from a person. If you are
          in immediate danger, contact local emergency services. In the United
          States, you can call or text <strong>988</strong> for the Suicide &amp;
          Crisis Lifeline. Outside the U.S.,{" "}
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>{" "}
          lists free support lines by country.
        </p>

        <h2>Reporting a note</h2>
        <p>
          Open a note, choose “Report this note,” and select the reason that fits
          best. If the note contains an immediate threat, contact local emergency
          services first, then report it here.
        </p>

        <div className="content-cta">
          <p>This wall only works if we take care of it together.</p>
          <Link href="/" className="cta-button">Back to the wall</Link>
        </div>
      </article>
    </PageShell>
  );
}
