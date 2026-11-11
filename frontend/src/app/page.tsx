'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth";
import { ArrowRight, CheckCircle2, FileText, Zap, Users, BarChart3, ShieldCheck } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 overflow-hidden font-sans selection:bg-blue-500/30">
      
      {/* Animated Background Gradients */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/20 blur-[120px] animate-pulse" style={{ animationDuration: '5s' }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-4 md:px-12 backdrop-blur-md border-b border-white/5 bg-slate-950/50">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">SyncQuote</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#testimonials" className="hover:text-white transition-colors">Testimonials</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {mounted && isAuthenticated ? (
            <Link href="/dashboard" className="text-sm font-medium hover:text-blue-400 transition-colors">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/signin" className="text-sm font-medium hover:text-white transition-colors hidden sm:block">
                Sign In
              </Link>
              <Link href="/signin" className="text-sm font-medium px-4 py-2 bg-white text-slate-950 rounded-lg hover:bg-slate-200 transition-colors">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center pt-32 pb-20 px-6 text-center max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-blue-400 mb-8 backdrop-blur-md shadow-2xl">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          SyncQuote 2.0 is now live
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          Close Deals Faster with <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-500">
            Interactive Proposals
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
          Transform static PDFs into dynamic, trackable web links. Impress clients, collaborate in real-time, and get paid faster with SyncQuote.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          {mounted && isAuthenticated ? (
            <Link
              href="/dashboard"
              className="group relative px-8 py-4 bg-white text-slate-950 font-bold rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Go to Dashboard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          ) : (
            <Link
              href="/signin"
              className="group relative px-8 py-4 bg-white text-slate-950 font-bold rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)]"
            >
              <span className="relative z-10 flex items-center gap-2">
                Start for free
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
            </Link>
          )}
          <a
            href="#features"
            className="px-8 py-4 font-medium rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
          >
            Explore Features
          </a>
        </div>

        {/* Abstract Mockup UI */}
        <div className="mt-24 w-full max-w-4xl relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-transparent blur-3xl -z-10" />
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col transform perspective-1000 rotate-x-12 scale-100 md:scale-105 transition-transform duration-700 hover:rotate-x-0">
            {/* Mockup Header */}
            <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2 bg-slate-950/50">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <div className="mx-auto w-64 h-6 bg-slate-800 rounded-md" />
            </div>
            {/* Mockup Body */}
            <div className="p-8 grid grid-cols-3 gap-6 opacity-80">
              <div className="col-span-2 space-y-4">
                <div className="h-8 w-3/4 bg-slate-800 rounded-lg animate-pulse" />
                <div className="h-4 w-full bg-slate-800 rounded-lg animate-pulse delay-75" />
                <div className="h-4 w-5/6 bg-slate-800 rounded-lg animate-pulse delay-100" />
                <div className="h-32 w-full bg-slate-800 rounded-xl mt-6 border border-white/5 flex items-center justify-center">
                  <div className="text-slate-600 font-medium flex items-center gap-2">
                    <FileText className="w-5 h-5" /> Rich Editor
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-24 w-full bg-gradient-to-br from-blue-600/20 to-violet-600/20 rounded-xl border border-blue-500/20 p-4">
                  <div className="h-4 w-20 bg-blue-500/40 rounded mb-2" />
                  <div className="h-8 w-32 bg-blue-500/60 rounded" />
                </div>
                <div className="h-12 w-full bg-slate-800 rounded-lg" />
                <div className="h-12 w-full bg-slate-800 rounded-lg" />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Social Proof */}
      <section className="relative z-10 border-y border-white/5 bg-slate-950/50 backdrop-blur-sm py-12">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/5">
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-white">35%</div>
            <div className="text-sm text-slate-400 uppercase tracking-wider">Higher Win Rate</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-white">4hrs</div>
            <div className="text-sm text-slate-400 uppercase tracking-wider">Saved Per Week</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-white">10k+</div>
            <div className="text-sm text-slate-400 uppercase tracking-wider">Proposals Sent</div>
          </div>
          <div className="space-y-2">
            <div className="text-3xl md:text-4xl font-bold text-white">99.9%</div>
            <div className="text-sm text-slate-400 uppercase tracking-wider">Uptime SLA</div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="relative z-10 py-32 px-6 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Everything you need to close.</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">A complete toolkit designed to eliminate friction between your pitch and their payment.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Big Feature 1 */}
          <div className="md:col-span-2 rounded-3xl p-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 hover:border-blue-500/30 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:scale-110 transition-transform duration-500">
              <Zap className="w-32 h-32 text-blue-500" />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-end min-h-[300px]">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Smart Templates</h3>
              <p className="text-slate-400 max-w-sm">Stop starting from scratch. Build your library of winning blocks and generate proposals in seconds, not hours.</p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="rounded-3xl p-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 hover:border-violet-500/30 transition-colors">
            <div className="h-full flex flex-col justify-end min-h-[300px]">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-violet-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Real-time Collab</h3>
              <p className="text-slate-400">Threaded comments and instant notifications keep the conversation inside the proposal.</p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="rounded-3xl p-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 hover:border-emerald-500/30 transition-colors">
            <div className="h-full flex flex-col justify-end min-h-[300px]">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Secure Client Portal</h3>
              <p className="text-slate-400">A dedicated, branded space for clients to view, sign, and pay directly.</p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="md:col-span-2 rounded-3xl p-8 bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 hover:border-pink-500/30 transition-colors relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 opacity-30">
              <BarChart3 className="w-48 h-48 text-pink-500" />
            </div>
            <div className="relative z-10 h-full flex flex-col justify-end min-h-[300px]">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-pink-400" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Deep Analytics</h3>
              <p className="text-slate-400 max-w-sm">Know exactly when they open it, what they read, and how much time they spend on pricing.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative z-10 py-32 px-6 max-w-6xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Loved by agencies worldwide.</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Don't just take our word for it. See what our users have to say.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { quote: "SyncQuote cut our proposal creation time in half. The analytics alone are worth the price.", author: "Sarah J.", role: "Agency Founder" },
            { quote: "Clients love the interactive pricing tables. Our win rate went up 40% in the first month.", author: "Mark T.", role: "Sales Director" },
            { quote: "The easiest e-signature flow I've ever used. Getting paid is now completely frictionless.", author: "Elena R.", role: "Freelance Designer" }
          ].map((t, i) => (
            <div key={i} className="p-8 rounded-3xl bg-slate-900 border border-white/5 relative">
              <div className="text-blue-500 text-4xl font-serif absolute top-6 left-6 opacity-20">"</div>
              <p className="text-slate-300 relative z-10 mb-6 mt-4">"{t.quote}"</p>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                  {t.author.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-white">{t.author}</div>
                  <div className="text-xs text-slate-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative z-10 py-32 px-6 max-w-6xl mx-auto border-t border-white/5">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Simple, transparent pricing.</h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">Start for free, upgrade when you need more power.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Free Tier */}
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 flex flex-col">
            <h3 className="text-xl font-bold mb-2">Starter</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 3 active proposals</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Basic templates</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Standard support</li>
            </ul>
            <Link href="/signin" className="w-full py-3 rounded-xl border border-white/10 font-medium hover:bg-white/5 transition-colors text-center">Get Started</Link>
          </div>
          
          {/* Pro Tier */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-blue-900/40 to-slate-900 border border-blue-500/30 flex flex-col relative transform md:-translate-y-4 shadow-2xl shadow-blue-900/20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full">MOST POPULAR</div>
            <h3 className="text-xl font-bold mb-2">Pro</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold">$29</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Unlimited proposals</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Advanced analytics</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Custom branding</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Priority support</li>
            </ul>
            <Link href="/signin" className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors text-center shadow-lg shadow-blue-500/25">Start Free Trial</Link>
          </div>

          {/* Enterprise Tier */}
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-white/5 flex flex-col">
            <h3 className="text-xl font-bold mb-2">Agency</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold">$99</span>
              <span className="text-slate-400 text-sm">/month</span>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Everything in Pro</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Up to 10 team members</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> API access</li>
              <li className="flex items-center gap-3 text-slate-300 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Dedicated account manager</li>
            </ul>
            <Link href="/signin" className="w-full py-3 rounded-xl border border-white/10 font-medium hover:bg-white/5 transition-colors text-center">Contact Sales</Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-32 border-t border-white/5 bg-slate-950 text-center px-6">
        <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to upgrade your workflow?</h2>
        <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">Join thousands of modern agencies and freelancers who use SyncQuote to close deals faster.</p>
        {mounted && isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              Go to Dashboard
            </Link>
          ) : (
            <Link
              href="/signin"
              className="inline-flex px-8 py-4 bg-gradient-to-r from-blue-600 to-violet-600 text-white font-bold rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-lg"
            >
              Start Your Free Trial
            </Link>
          )}
      </section>
      
      {/* Footer */}
      <footer className="relative z-10 py-12 border-t border-white/5 bg-slate-950">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
                <FileText className="w-3 h-3 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">SyncQuote</span>
            </div>
            <p className="text-slate-400 text-sm max-w-xs">
              The modern way to send proposals, close deals, and get paid faster.
            </p>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#testimonials" className="hover:text-white transition-colors">Customer Stories</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li>
                <a href="mailto:support@faizanmalik.me" className="hover:text-white transition-colors">
                  Support
                </a>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="text-center text-slate-600 text-sm border-t border-white/5 pt-8">
          &copy; {new Date().getFullYear()} SyncQuote. Design-partner MVP ·{' '}
          <a href="mailto:support@faizanmalik.me" className="hover:text-slate-400">
            support@faizanmalik.me
          </a>
        </div>
      </footer>
    </div>
  );
}
