import type { Metadata } from "next";
import QRCode from "qrcode";
import PageShell from "@/components/PageShell";
import PrintButton from "@/components/PrintButton";

export const metadata: Metadata = {
  title: "Host a Wall",
  description:
    "Bring Subway Therapy to your classroom, office, library, or community event with printable note cards, a QR code, and a simple event guide.",
  alternates: { canonical: "/host" },
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://subwaytherapy.net";

const CARD_PROMPTS = [
  "What do you wish someone told you today?",
  "What is one small thing you are proud of?",
  "Who are you carrying with you?",
  "What would you leave for a stranger?",
  "What are you letting go of?",
  "What gives you hope right now?",
];

const STEPS = [
  {
    number: "1",
    title: "Print the cards",
    body: "Print the six cards on this page, or use your own sticky notes. Each card has a prompt and a QR code that opens the wall.",
  },
  {
    number: "2",
    title: "Make a quiet space",
    body: "A table, a few pens, and a wall or window are enough. Put the prompt cards face up. Let people write without being watched.",
  },
  {
    number: "3",
    title: "Add the notes to the wall",
    body: "People can scan the QR code and post their note themselves, or photograph the physical notes and post them with permission.",
  },
];

const CHECKLIST = [
  "Choose a low-traffic spot with a table and seating, if possible.",
  "Bring pens, sticky notes, tape, and a few printed prompt cards.",
  "Put up a small sign that explains the project and the one-note-per-day ritual.",
  "Keep the space voluntary. Invite, do not instruct people to share.",
  "Have local support resources available if the event touches difficult material.",
  "Ask before photographing anyone or their note.",
  "Leave the wall up for a few days so people can return to it.",
];

export default async function HostPage() {
  const qrTarget = `${siteUrl}/?utm_source=host-a-wall&utm_medium=print`;
  const qr = await QRCode.toDataURL(qrTarget, {
    margin: 1,
    width: 240,
    color: { dark: "#1C1C1C", light: "#FFFFFF" },
  });

  return (
    <PageShell>
      <div className="host-page max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="max-w-2xl no-print">
          <p className="eyebrow">Host a Wall</p>
          <h1
            className="text-3xl sm:text-5xl text-white leading-[1.05]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Bring the wall
            <br />
            to your own room.
          </h1>
          <p className="text-white/50 text-sm sm:text-base mt-4 leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
            Subway Therapy began with a table, a stack of notes, and permission to
            be honest in public. You can host a version of that ritual in a
            classroom, office, library, community center, or living room. It costs
            nothing and needs no account.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <PrintButton />
            <a
              href={`mailto:hello@subwaytherapy.net?subject=${encodeURIComponent("Hosting a Subway Therapy wall")}&body=${encodeURIComponent("Hi — I would like to host a wall. Here is what I have in mind:\n\nLocation:\nDate:\nAudience:\n")}`}
              className="px-5 py-3 rounded-lg border border-white/15 bg-white/[0.04] text-white/75 hover:text-white text-sm mta-button touch-target"
            >
              Tell us about your event
            </a>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-10 no-print">
          {STEPS.map((step) => (
            <div key={step.number} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm mb-3"
                style={{ backgroundColor: "var(--mta-green)", fontFamily: "var(--font-display)", fontWeight: 700 }}
              >
                {step.number}
              </span>
              <h2
                className="text-white text-base mb-2"
                style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
              >
                {step.title}
              </h2>
              <p className="text-white/45 text-xs leading-relaxed" style={{ fontFamily: "var(--font-body)" }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-12 no-print">
          <h2
            className="text-white text-xl mb-4"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            A simple event guide
          </h2>
          <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 max-w-3xl">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-2 text-white/50 text-sm" style={{ fontFamily: "var(--font-body)" }}>
                <span className="text-[var(--mta-green)] mt-0.5" aria-hidden="true">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5 no-print">
            <div>
              <h2
                className="text-white text-xl"
                style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
              >
                Printable prompt cards
              </h2>
              <p className="text-white/40 text-xs mt-1" style={{ fontFamily: "var(--font-body)" }}>
                Six cards. Print on letter or A4 paper, cut along the dashed lines.
              </p>
            </div>
            <PrintButton />
          </div>

          <div className="print-cards grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CARD_PROMPTS.map((prompt, index) => (
              <article key={prompt} className="print-card">
                <div className="flex items-start justify-between gap-2">
                  <span className="print-card-mark">ST</span>
                  <span className="print-card-number">0{index + 1}</span>
                </div>
                <p className="print-card-prompt">{prompt}</p>
                <div className="print-card-lines" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="print-card-footer">
                  <div>
                    <p className="print-card-brand">SUBWAY THERAPY</p>
                    <p className="print-card-url">subwaytherapy.net</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qr} alt="QR code to the Subway Therapy wall" width={64} height={64} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-white/10 bg-white/[0.03] p-6 no-print">
          <h2
            className="text-white text-lg mb-2"
            style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
          >
            Partner walls
          </h2>
          <p className="text-white/45 text-sm leading-relaxed max-w-2xl" style={{ fontFamily: "var(--font-body)" }}>
            Schools, libraries, museums, and community organizations can host a
            partner wall and direct participants to the same virtual wall. We can
            provide a co-branded page, a custom QR code, and a short facilitation
            guide. Write to{" "}
            <a href="mailto:hello@subwaytherapy.net" className="text-white/75 underline underline-offset-2">
              hello@subwaytherapy.net
            </a>{" "}
            with “Partner wall” in the subject line.
          </p>
        </section>
      </div>
    </PageShell>
  );
}
