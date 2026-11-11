import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — SyncQuote',
  description: 'How SyncQuote handles account and proposal data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-6 py-16 space-y-6">
        <p className="text-sm text-slate-500">
          <Link href="/" className="text-blue-600 hover:underline">
            SyncQuote
          </Link>{' '}
          · Privacy Policy (stub)
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="text-slate-600">
          Last updated: {new Date().toISOString().slice(0, 10)}. This is a design-partner stub,
          not legal advice.
        </p>
        <section className="space-y-3 text-sm leading-relaxed text-slate-700">
          <p>
            SyncQuote stores account details (name, email), proposal content you create, client
            contact fields you enter, view/acceptance activity, and payment metadata processed by
            Stripe.
          </p>
          <p>
            We use this data to operate the product (auth, sharing links, notifications, billing).
            We do not sell personal data.
          </p>
          <p>
            Questions:{' '}
            <a className="text-blue-600 hover:underline" href="mailto:support@faizanmalik.me">
              support@faizanmalik.me
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
