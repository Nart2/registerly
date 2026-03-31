import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link, useSearchParams } from "@remix-run/react";
import { getRegistrationById } from "~/services/registration.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const registrationId = params.registrationId;
  if (!registrationId) throw new Response("Not found", { status: 404 });

  const registration = await getRegistrationById(registrationId);
  if (!registration) throw new Response("Registration not found", { status: 404 });

  return json({ registration });
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "APPROVED": return "badge-success";
    case "PENDING": return "badge-warning";
    case "REJECTED": return "badge-error";
    case "OPEN": return "badge-info";
    case "IN_REVIEW": return "badge-info";
    case "RESOLVED": return "badge-success";
    default: return "badge-info";
  }
}

function getWarrantyProgress(purchaseDate: string, expiresAt: string | null): number {
  if (!expiresAt) return 0;
  const start = new Date(purchaseDate).getTime();
  const end = new Date(expiresAt).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

function getMonthsRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "N/A";
  const now = new Date();
  const end = new Date(expiresAt);
  if (end <= now) return "Expired";
  const months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
  if (months <= 0) {
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} day${days !== 1 ? "s" : ""} remaining`;
  }
  return `${months} month${months !== 1 ? "s" : ""} remaining`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PortalPage() {
  const { registration } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

  const reg = registration as any;
  const isWarrantyActive = reg.status === "APPROVED" && reg.warrantyExpiresAt && new Date(reg.warrantyExpiresAt) > new Date();
  const brandColor = reg.shop?.brandColor || "#4F46E5";
  const warrantyProgress = getWarrantyProgress(reg.purchaseDate, reg.warrantyExpiresAt);
  const monthsRemaining = getMonthsRemaining(reg.warrantyExpiresAt);

  return (
    <div className="min-h-screen bg-surface">
      {/* Soft gradient header area */}
      <div style={{ background: justRegistered
        ? 'linear-gradient(180deg, #ECFDF5 0%, #F0FDF8 40%, #FAFBFC 100%)'
        : 'linear-gradient(180deg, #EEF2FF 0%, #F5F7FF 60%, #FAFBFC 100%)'
      }}>
        <div className="max-w-2xl mx-auto px-4 pt-12 pb-10">
          {justRegistered ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm mb-4">
                <svg className="w-8 h-8 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">You're all set!</h1>
              <p className="text-sm text-gray-500 mt-1.5">Your product is registered and protected. We'll review it shortly.</p>
              <p className="text-xs text-gray-400 mt-1">ID: {reg.id.slice(0, 8)}</p>
            </div>
          ) : (
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Your Product Registration</h1>
              <p className="text-sm text-gray-400 mt-1">ID: {reg.id.slice(0, 8)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Card — pulled up into gradient transition */}
      <div className="max-w-2xl mx-auto px-4 -mt-4 pb-10">
        <div className="card mb-6" style={{ borderTop: '3px solid #4F46E5' }}>
          {/* Product heading + status */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{reg.product.name}</h2>
            </div>
            <div className="text-right shrink-0">
              <span className={statusBadgeClass(reg.status)}>{reg.status}</span>
              {reg.status === "PENDING" && (
                <p className="text-xs text-gray-400 mt-1.5">Usually reviewed within 24 hours</p>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4">
            <InfoField label="Customer Name" value={reg.customerName} />
            <InfoField label="Email" value={reg.customerEmail} />
            {reg.serialNumber && (
              <InfoField label="Serial Number" value={reg.serialNumber} />
            )}
            <InfoField label="Purchase Date" value={formatDateFull(reg.purchaseDate)} />
            <InfoField label="Channel" value={reg.purchaseChannel} />
            <InfoField label="Warranty Expires" value={reg.warrantyExpiresAt ? formatDateFull(reg.warrantyExpiresAt) : "N/A"} />
          </div>

          {/* Warranty Timeline */}
          <div className="mt-8 p-5 rounded-lg bg-gray-50 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Warranty Status</p>
              <p className={`text-sm font-medium ${isWarrantyActive ? "text-emerald-600" : reg.status === "PENDING" ? "text-brand-600" : "text-red-600"}`}>
                {isWarrantyActive ? monthsRemaining : reg.status === "PENDING" ? "Pending Approval" : "Expired"}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full overflow-hidden" style={{ height: '6px' }}>
              <div
                className={`h-full rounded-full transition-all duration-500 ${isWarrantyActive ? "bg-emerald-500" : reg.status === "PENDING" ? "bg-brand-500" : "bg-red-400"}`}
                style={{ width: `${reg.status === "PENDING" ? 10 : warrantyProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{formatDate(reg.purchaseDate)}</span>
              <span>{reg.warrantyExpiresAt ? formatDate(reg.warrantyExpiresAt) : "N/A"}</span>
            </div>
          </div>

          {/* Next Steps */}
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-3">What's next?</p>
            <div className="space-y-2.5">
              <p className="text-sm text-gray-500 flex items-center gap-2.5">
                <svg className="w-5 h-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                Check your email for a confirmation
              </p>
              <p className="text-sm text-gray-500 flex items-center gap-2.5">
                <svg className="w-5 h-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                Bookmark this page to check your status
              </p>
              {isWarrantyActive && (
                <Link
                  to={`/claim/${reg.id}/new`}
                  className="text-sm text-brand-600 font-medium flex items-center gap-2.5 hover:text-brand-700 transition-colors"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Submit a claim if you experience any issues
                </Link>
              )}
              {!isWarrantyActive && (
                <p className="text-sm text-gray-500 flex items-center gap-2.5">
                  <svg className="w-5 h-5 text-brand-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                  Submit a claim if you experience any issues
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Submit Claim CTA */}
        {isWarrantyActive && (
          <div className="text-center mb-6">
            <Link
              to={`/claim/${reg.id}/new`}
              className="btn-primary inline-block w-full text-center text-base"
              style={{ backgroundColor: brandColor }}
            >
              Submit a Warranty Claim
            </Link>
          </div>
        )}

        {/* Claims List */}
        {reg.claims && reg.claims.length > 0 && (
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-5">Your Claims</h3>
            <div className="space-y-3">
              {reg.claims.map((claim: any) => (
                <div key={claim.id} className="p-4 border border-gray-100 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">Claim #{claim.id.slice(0, 8)}</p>
                        <span className={statusBadgeClass(claim.status)}>{claim.status}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1.5">{claim.issueType.replace("_", " ")} — {claim.issueDescription}</p>
                      {claim.merchantNotes && (
                        <p className="text-sm text-gray-600 mt-2 italic">Merchant response: {claim.merchantNotes}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2.5">Submitted {formatDateFull(claim.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-10 py-4">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-400 tracking-wide">Secured by <span className="text-brand-600 font-medium">Registerly</span></p>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-gray-400 uppercase font-semibold" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{value}</p>
    </div>
  );
}
