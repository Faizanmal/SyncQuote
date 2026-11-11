import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — SyncQuote',
  description: 'Terms for using SyncQuote during design-partner access.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
        <p className="text-sm text-slate-500">
          <Link href="/" className="text-blue-600 hover:underline">
            SyncQuote
          </Link>{' '}
          · Terms of Service (stub)
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="text-slate-600">
          Last updated: {new Date().toISOString().slice(0, 10)}. This is a design-partner stub,
          not legal advice.
        </p>
        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            SyncQuote is provided as an early MVP for invited design partners. Features may change,
            and uptime is best-effort.
          </p>
          <p>
            Proposal acceptance on public links records client intent (name, canvas mark, IP,
            timestamp). It is not a certified electronic-signature product.
          </p>
          <p>
            You are responsible for content you send to clients and for complying with applicable
            laws in your jurisdiction.
          </p>
          <p>
            Support:{' '}
            <a className="text-blue-600 hover:underline" href="mailto:support@faizanmalik.me">
              support@faizanmalik.me
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
