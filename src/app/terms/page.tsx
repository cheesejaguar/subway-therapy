export const metadata = { title: "Subway Therapy terms of use" };
export default function Page() {
  return (
    <article
      className="mx-auto max-w-3xl p-6 leading-7"
      style={{ maxHeight: "100dvh", overflowY: "auto" }}
    >
      <a href="/">Home</a>
      <h1 className="text-3xl font-bold my-6">Subway Therapy terms of use</h1>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Using the service</h2>
        <p>
          Notes are public. Do not post personal information about yourself or
          others. This wall is not a counseling or emergency service.
        </p>
      </section>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Responsible use</h2>
        <p>
          Do not harass others, publish unlawful material, infringe content
          rights, bypass access controls, or disrupt the service. You retain
          rights in content you submit; submit only material you have permission
          to share.
        </p>
      </section>
      <section className="my-6">
        <h2 className="text-xl font-semibold">Availability and rights</h2>
        <p>
          Features and availability may change. Verify information before
          relying on it. Nothing in these terms limits rights that cannot be
          excluded under applicable law.
        </p>
      </section>
      <nav aria-label="Site information" className="flex flex-wrap gap-4">
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
        <a href="/cookies">Cookies</a>
        <a href="/delete">Data deletion</a>
      </nav>
    </article>
  );
}
