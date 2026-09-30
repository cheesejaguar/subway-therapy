import Link from "next/link";
export const metadata = { title: "Subway Therapy privacy notice" };
export default function Page() {
  return (
    <article
      className="mx-auto max-w-3xl p-6 leading-7"
      style={{ maxHeight: "100dvh", overflowY: "auto" }}
    >
      <Link href="/">Home</Link>
      <h1 className="text-3xl font-bold my-6">Subway Therapy privacy notice</h1>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Public notes</h2>
        <p>
          Notes you submit are published on a public wall. Text, drawings,
          colors, and attached note images may be visible to anyone. Do not
          include names, contact details, or other information you do not want
          made public.
        </p>
      </section>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Storage and moderation</h2>
        <p>
          The service processes submitted content, a session identifier, posting
          times, reports, and abuse-prevention signals. Depending on
          configuration, notes are stored using Convex and images using Vercel
          Blob. Moderators can review and remove notes.
        </p>
      </section>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Browser and hosting</h2>
        <p>
          A session cookie and posting-limit state support abuse prevention.
          Onboarding preferences are saved in local storage. Hosting services
          process network requests needed to deliver and protect the wall.
        </p>
      </section>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Questions and retention</h2>
        <p>
          A dedicated private privacy-request contact and service-specific
          retention schedule remain to be designated. Do not publish personal
          information in project issues. This draft notice must be completed
          with operator details before release.
        </p>
      </section>
      <nav aria-label="Site information" className="flex flex-wrap gap-4">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/cookies">Cookies</Link>
        <Link href="/delete">Data deletion</Link>
      </nav>
    </article>
  );
}
