import Link from "next/link";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <span className="tag">Recovered · client-first</span>
        <h1>Claim your share of Superfluid.</h1>
        <p className="muted">
          A deployable reconstruction that reads public campaign data in your
          browser and keeps your wallet in control.
        </p>
        <div className="toolbar">
          <Link href="/claim">
            <button>Check my claim</button>
          </Link>
          <Link href="/apps">
            <button>Explore campaigns</button>
          </Link>
        </div>
      </section>
      <section className="grid">
        <article className="card">
          <h2>Public data</h2>
          <p className="muted">
            Campaign discovery is queried directly from the SUP and protocol
            subgraphs.
          </p>
        </article>
        <article className="card">
          <h2>No app server</h2>
          <p className="muted">
            Read behavior runs in the browser. The only compatibility call is
            the production voucher signer when a claim is submitted.
          </p>
        </article>
      </section>
    </main>
  );
}
