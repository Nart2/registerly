import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

export const meta: MetaFunction = () => [
  { title: "Privacy Policy — Registerly" },
  { name: "description", content: "Privacy policy for the Registerly Shopify app." },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-gray-900">Registerly</span>
            </Link>
            <Link to="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
              &larr; Back to home
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-400 mb-12">Last updated: March 31, 2026</p>

        <div className="prose-container space-y-10 text-gray-700 leading-relaxed">
          <Section title="1. Introduction">
            <p>
              Registerly (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) provides a product warranty registration and
              management application for Shopify merchants. This Privacy Policy explains how we collect, use, disclose,
              and safeguard information when you use our Shopify application.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p className="font-medium text-gray-900 mb-2">From merchants (app users):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Shopify store domain and shop information</li>
              <li>Product catalog data (titles, IDs, images)</li>
              <li>Order data for automatic warranty registration</li>
              <li>App configuration and billing preferences</li>
            </ul>

            <p className="font-medium text-gray-900 mt-4 mb-2">From customers (end users):</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name and email address</li>
              <li>Phone number (optional)</li>
              <li>Product serial numbers and proof of purchase</li>
              <li>Warranty claim details and supporting information</li>
            </ul>
          </Section>

          <Section title="3. How We Use Information">
            <p>We use the collected information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and maintain warranty registration services</li>
              <li>Process and manage warranty claims</li>
              <li>Send transactional emails (registration confirmations, claim updates, warranty expiry notifications)</li>
              <li>Display analytics and reports to merchants</li>
              <li>Process billing through Shopify&apos;s billing system</li>
              <li>Improve our application and services</li>
            </ul>
          </Section>

          <Section title="4. Data Sharing">
            <p>We do not sell personal data. We share data only in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>With merchants:</strong> Customer warranty registration and claim data is accessible to the merchant whose store the customer interacted with.</li>
              <li><strong>Service providers:</strong> We use Resend for email delivery and cloud hosting providers for data storage. These providers process data on our behalf under strict contractual obligations.</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law or to protect our rights.</li>
            </ul>
          </Section>

          <Section title="5. Data Storage & Security">
            <p>
              All data is stored in secure, encrypted databases. Each merchant&apos;s data is logically isolated —
              merchants can only access data related to their own store. We implement industry-standard security
              measures including encrypted connections (TLS/SSL), parameterized database queries, and rate limiting
              to protect against unauthorized access.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain merchant data for the duration of the app installation. When a merchant uninstalls the app,
              we retain data for 30 days to allow for reinstallation, after which it is permanently deleted.
              Customer warranty data is retained according to the merchant&apos;s warranty periods and applicable
              legal retention requirements.
            </p>
          </Section>

          <Section title="7. GDPR & Your Rights">
            <p>If you are located in the European Economic Area (EEA), you have the following rights:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate data</li>
              <li><strong>Erasure:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
              <li><strong>Restriction:</strong> Request limitation of processing</li>
              <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
            </ul>
            <p className="mt-3">
              We comply with Shopify&apos;s mandatory GDPR webhooks for customer data requests, customer data
              erasure, and shop data erasure. To exercise your rights, contact us at{" "}
              <a href="mailto:support@registerly.app" className="text-brand-600 hover:text-brand-700 underline">
                support@registerly.app
              </a>.
            </p>
          </Section>

          <Section title="8. Cookies & Tracking">
            <p>
              Registerly does not use cookies for tracking purposes. We use Shopify&apos;s session tokens for
              authentication within the embedded app. No third-party analytics or advertising trackers are used.
            </p>
          </Section>

          <Section title="9. Children&apos;s Privacy">
            <p>
              Our service is not directed to individuals under the age of 16. We do not knowingly collect personal
              information from children. If you become aware that a child has provided us with personal data,
              please contact us so we can take steps to remove that information.
            </p>
          </Section>

          <Section title="10. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify affected merchants via the app
              dashboard when significant changes are made. The &quot;Last updated&quot; date at the top of this page
              indicates when the policy was last revised.
            </p>
          </Section>

          <Section title="11. Contact Us">
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <p className="mt-2">
              <a href="mailto:support@registerly.app" className="text-brand-600 hover:text-brand-700 underline">
                support@registerly.app
              </a>
            </p>
          </Section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Registerly</span>
            </div>
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Registerly. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}
