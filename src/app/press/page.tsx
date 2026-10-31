import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

export const metadata: Metadata = {
  title: "Press",
  description:
    "Press information, founder background, and visual assets for Subway Therapy, the virtual continuation of Matthew Chavez’s original project.",
  alternates: { canonical: "/press" },
};

const FACTS = [
  ["What it is", "A free, anonymous virtual sticky-note wall inspired by the original Subway Therapy project."],
  ["Founded by", "Matthew “Levee” Chavez, artist and educator, New York City."],
  ["Original project", "Began in 2016 in the Union Square subway station, New York City."],
  ["This site", "An independent, authorized tribute built with Matthew Chavez’s permission."],
  ["Participation", "No account. One note per person per day. Text or drawing."],
  ["Affiliation", "Not affiliated with, endorsed by, or sponsored by the MTA or any transit agency."],
];

export default function PressPage() {
  return (
    <PageShell>
      <article className="content-prose max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <p className="eyebrow">Press kit</p>
        <h1>Subway Therapy, in a paragraph.</h1>
        <p className="lede">
          Subway Therapy is a public art project that invites people to write down
          what they are carrying and leave it for a stranger. It began in a New
          York City subway station in 2016 and continues here as a virtual wall.
        </p>

        <h2>Boilerplate</h2>
        <p>
          Subway Therapy is an independent community art project founded by artist
          Matthew “Levee” Chavez. In 2016, Chavez set up a table in the Union Square
          subway station and invited passersby to write anonymous sticky notes
          about what they were feeling. The project became a global symbol of
          public grief, hope, and solidarity. The virtual wall extends that ritual
          online: anyone can leave one anonymous note per day, read notes from
          around the world, and share the ones that stay with them. It is not
          affiliated with the MTA.
        </p>

        <h2>Fast facts</h2>
        <dl className="fact-list">
          {FACTS.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <h2>Founder</h2>
        <p>
          <strong>Matthew “Levee” Chavez</strong> is an artist, educator, and the
          founder of Subway Therapy. His work uses simple, participatory gestures
          to create room for honesty in public space. He is based in New York City.
        </p>

        <h2>Assets</h2>
        <p>
          You may use the share cards below in coverage of the project. Please do
          not alter the images or imply official affiliation with the MTA.
        </p>
        <ul>
          <li><a href="/api/og?format=wide" target="_blank" rel="noreferrer">Wide share card (1200 × 630)</a></li>
          <li><a href="/api/og?format=square" target="_blank" rel="noreferrer">Square share card (1080 × 1080)</a></li>
          <li><a href="/api/og?format=story" target="_blank" rel="noreferrer">Story share card (1080 × 1920)</a></li>
          <li><a href="/opengraph-image" target="_blank" rel="noreferrer">Default Open Graph image</a></li>
        </ul>

        <h2>Interview and media requests</h2>
        <p>
          For interviews with Matthew Chavez, high-resolution assets, or comment
          on the project, contact{" "}
          <a href="mailto:press@subwaytherapy.net">press@subwaytherapy.net</a>.
          Please include your outlet, deadline, and the angle you are pursuing.
        </p>

        <h2>Usage note</h2>
        <p>
          “Subway Therapy” refers to the project founded by Matthew Chavez. When
          covering this site, please describe it as the virtual continuation of the
          project and note that it is independent of the MTA. Do not use MTA logos
          or transit marks in a way that suggests endorsement.
        </p>
      </article>
    </PageShell>
  );
}
