/**
 * Local test route for the merchant dashboard (no Shopify auth needed).
 * Access at: http://localhost:3000/test-dashboard
 * DELETE THIS FILE before deploying to production.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import prisma from "~/db.server";
import { getRegistrationStats } from "~/services/registration.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

export const loader = async () => {
  let shop = await prisma.shop.findFirst();
  if (!shop) {
    return json({ shop: null, stats: null, registrations: [], products: [] });
  }

  const stats = await getRegistrationStats(shop.id);

  const registrations = await prisma.registration.findMany({
    where: { shopId: shop.id },
    include: { product: true, claims: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const products = await prisma.product.findMany({
    where: { shopId: shop.id },
    include: { _count: { select: { registrations: true } } },
  });

  return json({ shop, stats, registrations, products });
};

export default function TestDashboard() {
  const { shop, stats, registrations, products } = useLoaderData<typeof loader>();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  if (!shop) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-gray-900 font-semibold mb-1">No shop found</p>
          <p className="text-sm text-gray-500">Run <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">npx prisma db seed</code> first.</p>
        </div>
      </div>
    );
  }

  const filteredRegistrations = registrations.filter((reg: any) => {
    const matchesSearch = search === "" ||
      reg.customerName.toLowerCase().includes(search.toLowerCase()) ||
      reg.customerEmail.toLowerCase().includes(search.toLowerCase()) ||
      (reg.serialNumber && reg.serialNumber.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "ALL" || reg.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusFilters = ["ALL", "PENDING", "APPROVED", "REJECTED"];

  return (
    <div className="min-h-screen bg-surface">
      {/* Dashboard Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between" style={{ height: '56px' }}>
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="text-base font-bold text-gray-900">Registerly</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{shop.domain}</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">
              {shop.plan}
            </span>
          </div>
        </div>
      </nav>

      {/* Tab Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex gap-6">
          <a
            href={`/register/${shop.domain}`}
            className="py-3 text-sm font-medium text-gray-500 hover:text-gray-700 border-b-2 border-transparent transition-colors"
          >
            Registration Page
          </a>
          <span className="py-3 text-sm font-medium text-brand-600 border-b-2 border-brand-600">
            Dashboard
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            title="Total Registrations"
            value={stats?.total || 0}
            iconBg="bg-brand-50"
            iconColor="text-brand-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
          />
          <StatCard
            title="Active Warranties"
            value={stats?.approved || 0}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
            hint={stats?.approved === 0 ? "Approve registrations to activate" : undefined}
          />
          <StatCard
            title="Open Claims"
            value={stats?.openClaims || 0}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />}
            hint={stats?.openClaims === 0 ? "No claims \u2014 that's great!" : undefined}
          />
          <StatCard
            title="Expiring Soon"
            value={stats?.expiringSoon || 0}
            iconBg="bg-red-50"
            iconColor="text-red-600"
            icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />}
            hint={stats?.expiringSoon === 0 ? "All warranties are healthy" : undefined}
          />
        </div>

        {/* Products */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Products</h2>
          </div>
          {products.length === 0 ? (
            <EmptyState
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />}
              title="No products yet"
              description="Products will appear here once they are added to the shop."
            />
          ) : (
            <div className="divide-y divide-gray-100">
              {products.map((product: any) => (
                <div key={product.id} className="group py-3 px-3 -mx-3 flex items-center justify-between rounded-lg hover:bg-gray-50 hover:shadow-sm transition-all duration-150 cursor-default">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {product.warrantyMonths} months warranty &middot; {product._count.registrations} registration{product._count.registrations !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                    {product.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Registrations */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <h2 className="text-base font-semibold text-gray-900">
              Registrations
            </h2>
            <div className="relative">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, email, serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input-field pl-9 text-sm"
                style={{ width: '280px', height: '36px' }}
              />
            </div>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 mb-5">
            {statusFilters.map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {registrations.length === 0 ? (
            <EmptyState
              icon={<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
              title="No registrations yet"
              description="Registrations will appear here once customers register their products."
              action={
                <a href={`/register/${shop.domain}`} className="btn-primary text-sm px-5 py-2 mt-3 inline-block">
                  Share Registration Link
                </a>
              }
            />
          ) : filteredRegistrations.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">No registrations match your search.</p>
            </div>
          ) : (
            <div className="overflow-x-auto -mx-8 px-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left">
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Customer</th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Product</th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Serial #</th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Status</th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Warranty Expires</th>
                    <th className="pb-3 text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRegistrations.map((reg: any) => (
                    <tr key={reg.id} className="hover:bg-brand-50/50 transition-colors">
                      <td className="py-3">
                        <p className="font-medium text-gray-900 text-sm">{reg.customerName}</p>
                        <p className="text-xs text-gray-400">{reg.customerEmail}</p>
                      </td>
                      <td className="py-3 text-sm text-gray-700">{reg.product.name}</td>
                      <td className="py-3 text-gray-500 font-mono text-xs">{reg.serialNumber || "\u2014"}</td>
                      <td className="py-3">
                        <StatusBadge status={reg.status} />
                      </td>
                      <td className="py-3 text-xs text-gray-500">
                        {reg.warrantyExpiresAt ? new Date(reg.warrantyExpiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                      </td>
                      <td className="py-3">
                        <a
                          href={`/portal/${reg.id}`}
                          className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                        >
                          View Portal
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, iconBg, iconColor, icon, hint }: {
  title: string;
  value: number;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <div className={`${iconBg} rounded-full p-2.5 shrink-0`} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg className={`w-5 h-5 ${iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {icon}
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase" style={{ fontSize: '11px', letterSpacing: '0.05em' }}>{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
          {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: "bg-emerald-50 text-emerald-700",
    PENDING: "bg-amber-50 text-amber-700",
    REJECTED: "bg-red-50 text-red-700",
  };
  const dotStyles: Record<string, string> = {
    APPROVED: "bg-emerald-500",
    PENDING: "bg-amber-500",
    REJECTED: "bg-red-500",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || "bg-gray-100 text-gray-600"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles[status] || "bg-gray-400"}`} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {icon}
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900">{title}</p>
      <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">{description}</p>
      {action}
    </div>
  );
}
