import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Subway Therapy collects, why, and how long it keeps it. Anonymous notes, limited technical data, and no advertising profiles.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <article className="content-prose max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="eyebrow">Privacy notice</p>
        <h1>What we collect, and why</h1>
        <p className="lede">
          Subway Therapy is built to require as little from you as possible. You
          do not need an account, a name, or an email address to leave a note.
        </p>
        <p className="text-sm text-white/40">Last updated: October 30, 2026</p>

        <h2>What you provide</h2>
        <p>
          When you post, we store the content of your note: text or a drawing, an
          optional description, the note’s color, its position on the wall, and
          the time it was posted. Notes are public by design and may be viewed,
          shared, or embedded by anyone.
        </p>
        <p>
          Do not include personal information in a note. If you do, it may be
          visible to the public before a moderator can remove it.
        </p>

        <h2>Technical information</h2>
        <ul>
          <li>
            <strong>Anonymous session cookie.</strong> A random identifier stored
            in your browser. It enforces the one-note-per-person-per-day ritual
            and remembers your daily slot. It is not linked to your name or email.
          </li>
          <li>
            <strong>Submission cookie.</strong> A timestamp of your last note, used
            to show the countdown in the interface.
          </li>
          <li>
            <strong>Rate-limit data.</strong> A one-way hash derived from your IP
            address, browser user agent, and session identifier. It is used to
            stop abuse and is not stored as a readable IP address by the
            application.
          </li>
          <li>
            <strong>Moderation and report records.</strong> A note’s moderation
            status, reports, and report reasons. Reports are tied to a one-way
            reporter hash so the same person cannot report the same note twice.
          </li>
          <li>
            <strong>Admin session cookie.</strong> Only for authorized moderators.
          </li>
        </ul>

        <h2>Analytics</h2>
        <p>
          We use Vercel Analytics and Vercel Speed Insights to understand aggregate
          traffic and performance. These tools provide aggregate measurements and
          do not use advertising cookies or build cross-site advertising profiles.
          We also record privacy-conscious product events, such as “note created”
          or “reaction added,” without note contents attached.
        </p>

        <h2>Service providers</h2>
        <ul>
          <li><strong>Vercel</strong> hosts the site, stores drawing images, and provides analytics and performance insights.</li>
          <li><strong>Convex</strong> stores note metadata, reactions, reports, and moderation state.</li>
          <li><strong>Vercel AI Gateway</strong> processes note content for automated moderation. Content is sent only for that purpose.</li>
        </ul>

        <h2>How long we keep things</h2>
        <p>
          Approved notes are intended to remain part of the wall in perpetuity as
          a living archive, unless removed for safety, legal, or operational
          reasons. Rejected notes are not shown publicly and may be retained for a
          limited period for moderation and abuse prevention. Server logs and
          rate-limit records are retained only as long as needed for security and
          operations.
        </p>

        <h2>Your choices</h2>
        <p>
          You can clear the session and submission cookies through your browser at
          any time. Clearing them may reset your daily note status. Because notes
          are anonymous, we may not be able to identify or remove a specific note
          on request; if you believe a note contains your personal information,
          report it and contact us.
        </p>

        <h2>Children</h2>
        <p>
          The wall is not directed to children under 13, and we do not knowingly
          collect personal information from them. If you believe a child has
          posted personal information, report the note so it can be reviewed.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy can be sent to{" "}
          <a href="mailto:hello@subwaytherapy.net">hello@subwaytherapy.net</a>.
        </p>

        <h2>Changes</h2>
        <p>
          We may update this notice as the project evolves. Material changes will
          be reflected on this page with a new date.
        </p>
      </article>
    </PageShell>
  );
}
