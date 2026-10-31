import type { Metadata } from "next";
import Link from "next/link";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "About",
  description:
    "Subway Therapy began in a New York City subway station in 2016. Learn about the original project by Matthew Chavez and this virtual continuation.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <PageShell>
      <article className="content-prose max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="eyebrow">The story</p>
        <h1>This started with a table and a stack of sticky notes.</h1>
        <p className="lede">
          In 2016, artist Matthew Chavez set up a small table in a New York City
          subway station and invited strangers to write down what they were
          carrying. No account. No camera. No explanation required. Just a note,
          a pen, and a wall.
        </p>

        <p>
          People wrote about love and loss, fear and hope, loneliness and
          gratitude. They wrote in English, Spanish, Arabic, Korean, and in
          drawings when words were not enough. The project became known as{" "}
          <strong>Subway Therapy</strong>, and the wall became a place where a
          city could be honest with itself.
        </p>

        <p>
          This site is a virtual continuation of that idea, made with Matthew
          Chavez’s permission and in collaboration with him. It is not a
          replacement for the original. It is another wall, for anyone who needs
          one, wherever they are.
        </p>

        <h2>What this wall is for</h2>
        <p>
          Subway Therapy is a place to leave something honest for the next
          person: a hope, a grief, a joke, a thank-you, a thought you have not
          said out loud. Notes are anonymous by default. You do not need an
          account, and you are not asked to perform wellness or optimism.
        </p>
        <p>
          The wall is public. Anyone can read what you post, and notes may be
          shared on social media. Please do not include personal information such
          as your phone number, address, workplace, or the full name of someone
          who has not consented.
        </p>

        <h2>One note per person per day</h2>
        <p>
          The ritual is intentional. One note a day keeps the wall from becoming
          a feed, and it gives each message room to breathe. The limit follows
          your anonymous browser session, not your household or your network, so
          people sharing a connection can each take part.
        </p>

        <h2>How notes are cared for</h2>
        <p>
          Every note passes through automated moderation and may be reviewed by a
          human moderator. Notes that contain hate speech, threats, harassment,
          explicit content, spam, or personal information are removed. The
          community can report a note from its detail view. Read the{" "}
          <a href="/guidelines">community guidelines</a> for the full picture.
        </p>

        <h2>Founder</h2>
        <p>
          <strong>Matthew “Levee” Chavez</strong> is an artist, educator, and the
          founder of Subway Therapy. The original project began in the Union
          Square subway station in New York City. His work has been covered by
          local and international press and has inspired community walls around
          the world.
        </p>

        <h2>Independence</h2>
        <p>
          This is an independent project. It is not affiliated with, endorsed by,
          or sponsored by the Metropolitan Transportation Authority (MTA), the
          New York City Transit Authority, or any transit agency. “MTA” and
          subway line marks belong to their respective owners. The wall’s visual
          language is an homage to the New York subway, not an official transit
          product.
        </p>

        <div className="content-cta">
          <p>Ready to leave something for the next person?</p>
          <Link href="/" className="cta-button">Leave a note</Link>
          <a href="/host" className="cta-button secondary">Host a wall</a>
        </div>
      </article>
    </PageShell>
  );
}
