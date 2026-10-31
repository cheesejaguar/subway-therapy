import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Terms of use",
  description:
    "The terms that govern use of the Subway Therapy virtual wall, including content ownership, moderation, and limitations.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PageShell>
      <article className="content-prose max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="eyebrow">Terms of use</p>
        <h1>The agreement, in plain language</h1>
        <p className="lede">
          By using Subway Therapy, you agree to these terms. They exist to keep the
          wall available, safe, and honest for everyone.
        </p>
        <p className="text-sm text-white/40">Last updated: October 30, 2026</p>

        <h2>1. The project</h2>
        <p>
          Subway Therapy is an independent virtual community art wall inspired by
          the original Subway Therapy project founded by Matthew Chavez. It is not
          affiliated with, endorsed by, or sponsored by the Metropolitan
          Transportation Authority (MTA) or any transit agency.
        </p>

        <h2>2. Using the wall</h2>
        <p>
          You may read and share public notes for personal, non-commercial use. You
          may post one note per person per day. You must not attempt to bypass the
          daily limit, automate posting, scrape the wall at scale, interfere with
          the service, or use the wall to harass, threaten, defraud, or harm
          others.
        </p>

        <h2>3. Your content</h2>
        <p>
          You keep ownership of the note you create. By posting, you grant Subway
          Therapy a worldwide, non-exclusive, royalty-free license to host,
          display, reproduce, and share the note as part of the project, including
          in promotional materials and share cards. You confirm that you have the
          right to post the content and that it does not violate another person’s
          rights.
        </p>
        <p>
          Notes are public and anonymous by default. Do not post personal
          information, confidential information, or content you do not have
          permission to use.
        </p>

        <h2>4. Moderation and removal</h2>
        <p>
          We may review, approve, reject, or remove any note at any time, with or
          without notice, if we believe it violates these terms or the{" "}
          <a href="/guidelines">community guidelines</a>, or if keeping it could
          harm someone or expose the project to legal risk. We are not obligated
          to publish any note.
        </p>

        <h2>5. No crisis or medical service</h2>
        <p>
          Subway Therapy is not a crisis line, therapy, medical care, or emergency
          service. If you are in immediate danger, contact local emergency
          services. In the United States, call or text <strong>988</strong>. Outside
          the U.S.,{" "}
          <a href="https://findahelpline.com" target="_blank" rel="noreferrer">
            findahelpline.com
          </a>{" "}
          lists support lines by country.
        </p>

        <h2>6. Availability and changes</h2>
        <p>
          The wall is provided on an “as is” and “as available” basis. We may
          change, suspend, or discontinue any part of the service at any time. We
          do not guarantee that any note will remain available or that the service
          will be uninterrupted or error-free.
        </p>

        <h2>7. Limitation of liability</h2>
        <p>
          To the fullest extent permitted by law, Subway Therapy and its
          collaborators are not liable for indirect, incidental, special,
          consequential, or punitive damages arising from your use of the wall, or
          for content posted by third parties. Nothing in these terms limits
          liability that cannot be limited by law.
        </p>

        <h2>8. Copyright and reports</h2>
        <p>
          If you believe content on the wall infringes your copyright or another
          legal right, contact{" "}
          <a href="mailto:hello@subwaytherapy.net">hello@subwaytherapy.net</a> with
          enough detail to identify the note and the right at issue. We will review
          and respond.
        </p>

        <h2>9. Changes to these terms</h2>
        <p>
          We may update these terms as the project evolves. The date at the top of
          this page will change when we do. Continued use of the wall after an
          update means you accept the revised terms.
        </p>

        <h2>10. Contact</h2>
        <p>
          Questions about these terms can be sent to{" "}
          <a href="mailto:hello@subwaytherapy.net">hello@subwaytherapy.net</a>.
        </p>
      </article>
    </PageShell>
  );
}
