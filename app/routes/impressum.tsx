import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

export const meta: MetaFunction = () => [
  { title: "Impressum — Registerly" },
];

export default function Impressum() {
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
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-12">Impressum</h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Angaben gem&auml;&szlig; &sect; 5 TMG</h2>
            <p>
              Lennart Heidloff<br />
              Saglerstra&szlig;e 1b<br />
              85635 H&ouml;henkirchen-Sigertsbrunn<br />
              Deutschland
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Kontakt</h2>
            <p>
              E-Mail:{" "}
              <a href="mailto:support@registerly.app" className="text-brand-600 hover:text-brand-700 underline">
                support@registerly.app
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Verantwortlich f&uuml;r den Inhalt gem&auml;&szlig; &sect; 18 Abs. 2 MStV</h2>
            <p>
              Lennart Heidloff<br />
              Saglerstra&szlig;e 1b<br />
              85635 H&ouml;henkirchen-Sigertsbrunn
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">EU-Streitschlichtung</h2>
            <p>
              Die Europ&auml;ische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit.
              Unsere E-Mail-Adresse finden Sie oben im Impressum.
            </p>
            <p className="mt-2">
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Haftung f&uuml;r Inhalte</h2>
            <p>
              Als Diensteanbieter sind wir gem&auml;&szlig; &sect; 7 Abs.1 TMG f&uuml;r eigene Inhalte auf diesen
              Seiten nach den allgemeinen Gesetzen verantwortlich. Nach &sect;&sect; 8 bis 10 TMG sind wir als
              Diensteanbieter jedoch nicht verpflichtet, &uuml;bermittelte oder gespeicherte fremde Informationen
              zu &uuml;berwachen oder nach Umst&auml;nden zu forschen, die auf eine rechtswidrige T&auml;tigkeit
              hinweisen.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Haftung f&uuml;r Links</h2>
            <p>
              Unser Angebot enth&auml;lt Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss
              haben. Deshalb k&ouml;nnen wir f&uuml;r diese fremden Inhalte auch keine Gew&auml;hr &uuml;bernehmen.
              F&uuml;r die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten
              verantwortlich.
            </p>
          </section>
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
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link to="/privacy" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
              <Link to="/impressum" className="hover:text-gray-900 transition-colors">Impressum</Link>
            </div>
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Registerly. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
