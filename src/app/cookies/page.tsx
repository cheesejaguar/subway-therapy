import Link from "next/link";
export const metadata = { title: "Subway Therapy cookies and storage" };
export default function Page() {
  return (
    <article
      className="mx-auto max-w-3xl p-6 leading-7"
      style={{ maxHeight: "100dvh", overflowY: "auto" }}
    >
      <Link href="/">Home</Link>
      <h1 className="text-3xl font-bold my-6">
        Subway Therapy cookies and storage
      </h1>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Necessary storage</h2>
        <p>
          A session cookie and posting-limit state support abuse prevention.
          Onboarding preferences are saved in local storage. Hosting services
          process network requests needed to deliver and protect the wall.
        </p>
      </section>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Your controls</h2>
        <p>
          You can inspect and remove cookies and local storage in browser
          settings. Clearing local storage may reset preferences or sign you
          out, and does not delete server-side records.
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
