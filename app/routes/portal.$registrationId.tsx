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

function statusColor(status: string) {
  switch (status) {
    case "APPROVED": return "bg-green-100 text-green-800";
    case "PENDING": return "bg-yellow-100 text-yellow-800";
    case "REJECTED": return "bg-red-100 text-red-800";
    case "OPEN": return "bg-blue-100 text-blue-800";
    case "IN_REVIEW": return "bg-purple-100 text-purple-800";
    case "RESOLVED": return "bg-green-100 text-green-800";
    default: return "bg-gray-100 text-gray-800";
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

export default function PortalPage() {
  const { registration } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

  const reg = registration as any;
  const isWarrantyActive = reg.status === "APPROVED" && reg.warrantyExpiresAt && new Date(reg.warrantyExpiresAt) > new Date();
  const brandColor = reg.shop?.brandColor || "#2563eb";
  const warrantyProgress = getWarrantyProgress(reg.purchaseDate, reg.warrantyExpiresAt);
  const monthsRemaining = getMonthsRemaining(reg.warrantyExpiresAt);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
        {/* Success banner */}
        {justRegistered && (
          <div className="mb-8 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">Product registered successfully!</p>
              <p className="text-sm text-green-600 mt-0.5">You will receive a confirmation email shortly.</p>
            </div>
          </div>
        )}

        {/* Main Card */}
        <div className="card mb-6">
          {/* Product heading + status */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{reg.product.name}</h1>
              <p className="text-sm text-gray-400 mt-1 font-mono">ID: {reg.id.slice(0, 8)}</p>
            </div>
            <span className={statusBadgeClass(reg.status)}>{reg.status}</span>
          </div>

          {/* Info Grid */}
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5">
            <InfoField
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />}
              label="Customer Name"
              value={reg.customerName}
            />
            <InfoField
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />}
              label="Email"
              value={reg.customerEmail}
            />
            {reg.serialNumber && (
              <InfoField
                icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />}
                label="Serial Number"
                value={reg.serialNumber}
              />
            )}
            <InfoField
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />}
              label="Purchase Date"
              value={new Date(reg.purchaseDate).toLocaleDateString()}
            />
            <InfoField
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />}
              label="Channel"
              value={reg.purchaseChannel}
            />
            <InfoField
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />}
              label="Warranty Expires"
              value={reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString() : "N/A"}
            />
          </div>

          {/* Warranty Timeline */}
          <div className="mt-8 p-5 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-700">Warranty Status</p>
              <p className={`text-sm font-medium ${isWarrantyActive ? "text-green-600" : reg.status === "PENDING" ? "text-amber-600" : "text-red-600"}`}>
                {isWarrantyActive ? monthsRemaining : reg.status === "PENDING" ? "Pending Approval" : "Expired"}
              </p>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isWarrantyActive ? "bg-green-500" : "bg-red-400"}`}
                style={{ width: `${warrantyProgress}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-400">
              <span>{new Date(reg.purchaseDate).toLocaleDateString()}</span>
              <span>{reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString() : "N/A"}</span>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Your Claims</h3>
            <div className="space-y-3">
              {reg.claims.map((claim: any) => (
                <div key={claim.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
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
                  <p className="text-xs text-gray-400 mt-2.5">Submitted {new Date(claim.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-10">
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-400">Secured by Registerly</p>
        </div>
      </div>
    </div>
  );
}

function InfoField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {icon}
      </svg>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-900 mt-0.5 truncate">{value}</p>
      </div>
    </div>
  );
}
