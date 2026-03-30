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

export default function PortalPage() {
  const { registration } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justRegistered = searchParams.get("registered") === "true";

  const reg = registration as any;
  const isWarrantyActive = reg.status === "APPROVED" && reg.warrantyExpiresAt && new Date(reg.warrantyExpiresAt) > new Date();
  const brandColor = reg.shop?.brandColor || "#2563eb";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Success banner */}
        {justRegistered && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <p className="font-medium">Product registered successfully!</p>
            <p className="text-sm mt-1">You'll receive a confirmation email shortly.</p>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Product Registration</h1>
          <p className="text-gray-500 mt-1">Registration ID: #{reg.id.slice(0, 8)}</p>
        </div>

        {/* Product Info Card */}
        <div className="card mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{reg.product.name}</h2>
              <p className="text-gray-500 text-sm mt-1">
                Registered on {new Date(reg.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(reg.status)}`}>
              {reg.status}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <InfoField label="Customer" value={reg.customerName} />
            <InfoField label="Email" value={reg.customerEmail} />
            {reg.serialNumber && <InfoField label="Serial Number" value={reg.serialNumber} />}
            <InfoField label="Purchase Date" value={new Date(reg.purchaseDate).toLocaleDateString()} />
            <InfoField label="Purchase Channel" value={reg.purchaseChannel} />
            <InfoField
              label="Warranty Expires"
              value={reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString() : "N/A"}
            />
          </div>

          {/* Warranty Status */}
          <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: isWarrantyActive ? "#f0fdf4" : "#fef2f2" }}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isWarrantyActive ? "bg-green-500" : "bg-red-500"}`} />
              <p className="font-medium" style={{ color: isWarrantyActive ? "#166534" : "#991b1b" }}>
                {isWarrantyActive ? "Warranty Active" : reg.status === "PENDING" ? "Pending Approval" : "Warranty Inactive"}
              </p>
            </div>
          </div>
        </div>

        {/* Submit Claim Button */}
        {isWarrantyActive && (
          <div className="mb-6">
            <Link
              to={`/claim/${reg.id}/new`}
              className="btn-primary w-full block text-center"
              style={{ backgroundColor: brandColor }}
            >
              Submit Warranty Claim
            </Link>
          </div>
        )}

        {/* Claims List */}
        {reg.claims && reg.claims.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Claims</h3>
            <div className="space-y-3">
              {reg.claims.map((claim: any) => (
                <div key={claim.id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Claim #{claim.id.slice(0, 8)}</p>
                      <p className="text-sm text-gray-500 mt-1">{claim.issueType.replace("_", " ")} — {claim.issueDescription}</p>
                      {claim.merchantNotes && (
                        <p className="text-sm text-gray-600 mt-2 italic">Merchant response: {claim.merchantNotes}</p>
                      )}
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(claim.status)}`}>
                      {claim.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Submitted {new Date(claim.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-8">Powered by Registerly</p>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-gray-900 mt-0.5">{value}</p>
    </div>
  );
}
