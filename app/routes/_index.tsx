import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Link } from "@remix-run/react";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  // If Shopify sends params (embedded, shop, host), redirect to the app
  if (url.searchParams.get("shop") || url.searchParams.get("host")) {
    return redirect(`/app${url.search}`);
  }
  return json({});
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Registerly</span>
            </div>
            <div className="hidden sm:flex items-center gap-8">
              <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Features</a>
              <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
              <a href="#faq" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
              <Link to="/privacy" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Privacy</Link>
              <Link to="/impressum" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Impressum</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-50 via-white to-brand-50/30" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Built for Shopify
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight">
              Product Warranty{" "}
              <span className="text-brand-600">Made Simple</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              Let your customers register products, track warranties, and submit claims — all from a beautiful, branded portal integrated directly into your Shopify store.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://apps.shopify.com"
                className="btn-primary text-base px-8 py-3.5 inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.34 2.62c-.18-.07-.36.04-.39.23l-.44 2.67c-.67-.3-1.45-.47-2.21-.47-3.5 0-5.78 3.16-5.78 6.48 0 2.6 1.64 4.09 3.71 4.09 1.32 0 2.36-.61 3.24-1.55l-.14.84c-.05.29.14.57.43.57h2.29c.24 0 .44-.17.48-.4l1.38-8.65c.07-.44-.01-.79-.16-1.04a2.97 2.97 0 00-2.41-2.77zm-1.72 7.42c-.43 1.52-1.36 2.5-2.46 2.5-1.08 0-1.58-.82-1.58-2.07 0-2.12 1.23-4.3 3.24-4.3.54 0 1.02.14 1.38.39l-.58 3.48z"/>
                </svg>
                Install on Shopify
              </a>
              <a href="#features" className="btn-outline text-base px-8 py-3.5">
                Learn more
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Bar */}
      <section className="border-y border-gray-100 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">60s</p>
              <p className="text-sm text-gray-500 mt-1">Registration time</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">100%</p>
              <p className="text-sm text-gray-500 mt-1">Shopify native</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">GDPR</p>
              <p className="text-sm text-gray-500 mt-1">Fully compliant</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">Free</p>
              <p className="text-sm text-gray-500 mt-1">To get started</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Everything you need to manage warranties</h2>
            <p className="mt-4 text-lg text-gray-600">From registration to claims — one seamless workflow for you and your customers.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Product Registration</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">Beautiful, mobile-friendly registration form. Customers register their products in under 60 seconds. Share via link or QR code.</p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Warranty Tracking</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">Automatic warranty expiry calculation. Customers see their warranty status in a personal portal. You get notified before warranties expire.</p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Claims Management</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">Customers submit warranty claims directly. Review, approve or reject with notes. Automatic email updates keep everyone informed.</p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Email Notifications</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">Automatic emails for registration confirmation, claim updates, and warranty expiry warnings. Fully customizable HTML templates.</p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-rose-100 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Analytics Dashboard</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">Track registrations by month, see top products, channel breakdown, claim rates, and growth trends. Data-driven warranty management.</p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-sm transition-all">
              <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center mb-5">
                <svg className="w-6 h-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">QR Codes & Serial Numbers</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">Generate QR codes for each product. Import serial numbers in bulk. Validate serial numbers during registration to prevent fraud.</p>
            </div>
          </div>

          {/* Extra features list */}
          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {[
              "Auto-registration on purchase",
              "Custom brand colors",
              "White-label portal (Pro)",
              "Shopify Billing integrated",
              "GDPR compliant",
              "Multi-channel support",
              "Customer self-service portal",
              "Embedded in Shopify Admin",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">How it works</h2>
            <p className="mt-4 text-lg text-gray-600">Set up in minutes. Works automatically from day one.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-5">1</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Install & configure</h3>
              <p className="text-gray-600">Install the app, sync your products from Shopify, and set warranty periods. Takes less than 5 minutes.</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-5">2</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Share with customers</h3>
              <p className="text-gray-600">Share your registration link or QR code. Customers also auto-register when they purchase from your store.</p>
            </div>
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 text-white flex items-center justify-center text-xl font-bold mx-auto mb-5">3</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage warranties</h3>
              <p className="text-gray-600">Review registrations, handle claims, and track analytics — all from your Shopify admin dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-gray-600">Start free. Upgrade as you grow. No hidden fees.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Free */}
            <div className="rounded-2xl border border-gray-200 p-6 flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Free</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">$0</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">50 registrations/month</p>
              <ul className="mt-6 space-y-3 flex-1">
                <PricingFeature>Standard email notifications</PricingFeature>
                <PricingFeature>QR code generation</PricingFeature>
                <PricingFeature>Customer portal</PricingFeature>
                <PricingFeature>Claims management</PricingFeature>
              </ul>
              <a href="https://apps.shopify.com" className="mt-8 btn-outline text-center text-sm py-2.5">Get started</a>
            </div>

            {/* Starter */}
            <div className="rounded-2xl border border-gray-200 p-6 flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Starter</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">$19</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">500 registrations/month</p>
              <ul className="mt-6 space-y-3 flex-1">
                <PricingFeature>Everything in Free</PricingFeature>
                <PricingFeature>Custom email templates</PricingFeature>
                <PricingFeature>Custom brand colors</PricingFeature>
                <PricingFeature>Priority support</PricingFeature>
              </ul>
              <a href="https://apps.shopify.com" className="mt-8 btn-outline text-center text-sm py-2.5">Get started</a>
            </div>

            {/* Growth — Highlighted */}
            <div className="rounded-2xl border-2 border-brand-600 p-6 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-600 text-white text-xs font-semibold px-3 py-1 rounded-full">Most Popular</div>
              <h3 className="text-lg font-semibold text-gray-900">Growth</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">$49</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">2,000 registrations/month</p>
              <ul className="mt-6 space-y-3 flex-1">
                <PricingFeature>Everything in Starter</PricingFeature>
                <PricingFeature>Serial number validation</PricingFeature>
                <PricingFeature>Analytics dashboard</PricingFeature>
                <PricingFeature>Priority support</PricingFeature>
              </ul>
              <a href="https://apps.shopify.com" className="mt-8 btn-primary text-center text-sm py-2.5">Get started</a>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border border-gray-200 p-6 flex flex-col">
              <h3 className="text-lg font-semibold text-gray-900">Pro</h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-gray-900">$99</span>
                <span className="text-gray-500">/mo</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Unlimited registrations</p>
              <ul className="mt-6 space-y-3 flex-1">
                <PricingFeature>Everything in Growth</PricingFeature>
                <PricingFeature>White-label portal</PricingFeature>
                <PricingFeature>Unlimited registrations</PricingFeature>
                <PricingFeature>Priority support</PricingFeature>
              </ul>
              <a href="https://apps.shopify.com" className="mt-8 btn-outline text-center text-sm py-2.5">Get started</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 text-center mb-12">Frequently asked questions</h2>

          <div className="space-y-6">
            <FaqItem
              question="How do customers register their products?"
              answer="Customers use a simple, mobile-friendly form accessible via a shareable link or QR code. Registration takes under 60 seconds. When customers purchase from your Shopify store, they can also be auto-registered via webhook."
            />
            <FaqItem
              question="Can I customize the look of the customer portal?"
              answer="Yes! On the Starter plan and above, you can set custom brand colors. On the Pro plan, you get full white-label — the Registerly branding is removed entirely from the customer-facing pages."
            />
            <FaqItem
              question="How does the billing work?"
              answer="Registerly uses Shopify's native billing system. You're charged through your regular Shopify invoice — no separate payment needed. You can upgrade or downgrade at any time."
            />
            <FaqItem
              question="Is my customer data safe?"
              answer="Absolutely. We're fully GDPR compliant with built-in data export and deletion. All data is stored securely and each merchant's data is completely isolated from others."
            />
            <FaqItem
              question="What happens when a warranty expires?"
              answer="Registerly tracks warranty expiry automatically. You can see which warranties are expiring soon from your dashboard. Customers can see their warranty status in their personal portal."
            />
            <FaqItem
              question="Can I import existing serial numbers?"
              answer="Yes, on the Growth plan and above. You can bulk-import serial numbers via CSV paste. When a customer registers, their serial number is validated against your imported list."
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Ready to manage product warranties?</h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Join merchants who use Registerly to streamline their warranty process. Free to get started, no credit card required.
          </p>
          <div className="mt-8">
            <a href="https://apps.shopify.com" className="btn-primary text-base px-8 py-3.5 inline-block">
              Install Registerly for Free
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Registerly</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/impressum" className="hover:text-gray-900 transition-colors">Impressum</Link>
              <a href="mailto:support@registerly.app" className="hover:text-gray-900 transition-colors">Support</a>
            </div>
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Registerly. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-gray-700">
      <svg className="w-4 h-4 text-brand-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      {children}
    </li>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group bg-white rounded-xl border border-gray-100 overflow-hidden">
      <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
        <h3 className="text-base font-medium text-gray-900 pr-4">{question}</h3>
        <svg className="w-5 h-5 text-gray-400 shrink-0 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-5 pb-5 -mt-1">
        <p className="text-gray-600 leading-relaxed">{answer}</p>
      </div>
    </details>
  );
}
