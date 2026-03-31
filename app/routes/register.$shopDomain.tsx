import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import React, { useState } from "react";
import { z } from "zod";
import prisma from "~/db.server";
import { createRegistration } from "~/services/registration.server";
import { checkRegistrationLimit, incrementRegistrationCount, hasFeature } from "~/services/billing.server";
import { rateLimitMiddleware } from "~/services/ratelimit.server";
import { sendEmail } from "~/services/email.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

const registrationSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  customerName: z.string().min(2, "Name must be at least 2 characters").max(200, "Name must be 200 characters or less"),
  customerEmail: z.string().email("Please enter a valid email").max(254, "Email must be 254 characters or less"),
  customerPhone: z.string().max(30, "Phone must be 30 characters or less").optional(),
  serialNumber: z.string().max(100, "Serial number must be 100 characters or less").optional(),
  purchaseDate: z.string().min(1, "Please enter a purchase date").refine((val) => {
    const date = new Date(val);
    if (isNaN(date.getTime())) return false;
    const now = new Date();
    if (date > now) return false;
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    if (date < fiveYearsAgo) return false;
    return true;
  }, "Purchase date must be a valid date, not in the future, and within the last 5 years"),
  purchaseChannel: z.enum(["SHOPIFY", "AMAZON", "RETAIL", "OTHER"]),
  consent: z.literal("on", { errorMap: () => ({ message: "You must agree to the terms" }) }),
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) throw new Response("Shop not found", { status: 404 });

  // Rate limit: 30 requests per minute per IP to prevent catalog scraping
  const rl = rateLimitMiddleware(request, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    throw new Response("Too many requests", { status: 429, headers: rl.headers });
  }

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
    },
  });

  if (!shop) throw new Response("Shop not found", { status: 404 });

  const url = new URL(request.url);
  const preselectedProduct = url.searchParams.get("product");

  const whiteLabel = hasFeature(shop.plan, "whiteLabel");

  return json({
    shop: { domain: shop.domain, brandColor: shop.brandColor, brandLogo: shop.brandLogo },
    products: shop.products.map((p) => ({
      id: p.id,
      name: p.name,
      warrantyMonths: p.warrantyMonths,
      requireSerialNumber: p.requireSerialNumber,
    })),
    preselectedProduct,
    whiteLabel,
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) throw new Response("Shop not found", { status: 404 });

  const rl = rateLimitMiddleware(request, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return json(
      { errors: { _form: "Too many requests. Please wait a moment before trying again." } },
      { status: 429, headers: rl.headers },
    );
  }

  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  const limitCheck = await checkRegistrationLimit(shop.id);
  if (!limitCheck.allowed) {
    return json(
      { errors: { _form: "This shop has reached its monthly registration limit. Please try again later." } },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const raw = Object.fromEntries(formData);

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return json({ errors }, { status: 400 });
  }

  try {
    const registration = await createRegistration({
      shopId: shop.id,
      productId: parsed.data.productId,
      customerName: parsed.data.customerName,
      customerEmail: parsed.data.customerEmail,
      customerPhone: parsed.data.customerPhone,
      serialNumber: parsed.data.serialNumber,
      purchaseDate: new Date(parsed.data.purchaseDate + "T12:00:00"),
      purchaseChannel: parsed.data.purchaseChannel,
      consentGiven: true,
    });

    await incrementRegistrationCount(shop.id);

    try {
      await sendEmail({
        to: registration.customerEmail,
        shopId: shop.id,
        templateType: "REGISTRATION_CONFIRM",
        variables: {
          customerName: registration.customerName,
          productName: registration.product.name,
          serialNumber: registration.serialNumber || "N/A",
          warrantyExpiry: registration.warrantyExpiresAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || "N/A",
          portalUrl: `${process.env.APP_URL}/portal/${registration.id}`,
        },
      });
    } catch (e) {
      console.error("Failed to send registration email:", e);
    }

    return redirect(`/portal/${registration.id}?registered=true`);
  } catch (error: any) {
    console.error("Registration error:", error);
    const safeMessages = ["Product not found or warranty not active", "Invalid serial number", "Serial number already registered", "Serial number is required"];
    const message = safeMessages.includes(error.message) ? error.message : "Something went wrong. Please try again.";
    return json({ errors: { _form: message } }, { status: 400 });
  }
};

export default function RegisterPage() {
  const { shop, products, preselectedProduct, whiteLabel } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = (actionData as any)?.errors || {};
  const hasErrors = Object.keys(errors).length > 0;

  // Navigate to the step containing the first error
  function getErrorStep(): number {
    if (errors._form) return 3;
    if (errors.productId) return 1;
    if (errors.customerName || errors.customerEmail) return 2;
    if (errors.serialNumber || errors.purchaseDate || errors.purchaseChannel || errors.consent) return 3;
    return 3;
  }
  const [step, setStep] = useState(hasErrors ? getErrorStep() : 1);

  const stepLabels = ["Choose product", "Your details", "Confirm"];

  return (
    <div className="min-h-screen bg-surface">
      {/* Colored header — soft indigo, clearly visible but not aggressive */}
      <div style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #818CF8 100%)' }}>
        <div className="max-w-xl mx-auto px-4 pt-10 pb-16 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm mb-4">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Register Your Product</h1>
          <p className="text-indigo-200 text-sm mt-1.5">Get warranty protection in 60 seconds</p>
        </div>
      </div>

      {/* Form Card — overlaps the colored header */}
      <div className="max-w-xl mx-auto px-4 -mt-8 pb-10">
        <div className="card">
          {errors._form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{errors._form}</span>
            </div>
          )}

          {/* Stepper */}
          <div className="flex items-center justify-center mb-2">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-150 ${
                  step > s
                    ? 'bg-brand-600 text-white'
                    : step === s
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : 'bg-white text-gray-400 border-2 border-gray-200'
                }`}>
                  {step > s ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  ) : s}
                </div>
                {s < 3 && (
                  <div className={`w-12 sm:w-16 h-0.5 transition-colors duration-150 ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`} style={{ height: '2px' }} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* All step labels always visible */}
          <div className="flex justify-center gap-4 sm:gap-10 mb-8">
            {stepLabels.map((label, i) => (
              <span key={i} className={`text-xs transition-colors ${step === i + 1 ? 'text-brand-600 font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            ))}
          </div>

          <Form method="post" className="space-y-6">
            {/* Step 1: Product Selection */}
            <div className={step !== 1 ? "hidden" : undefined}>
              <p className="section-title">Product Selection</p>
              <div>
                <label htmlFor="productId" className="block text-sm font-medium text-gray-700 mb-1.5">Product *</label>
                <select
                  id="productId"
                  name="productId"
                  defaultValue={preselectedProduct || ""}
                  className="input-field"
                  required
                >
                  <option value="">Select your product...</option>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.warrantyMonths} months warranty
                    </option>
                  ))}
                </select>
                {errors.productId && <p className="text-red-500 text-sm mt-1.5">{errors.productId}</p>}
              </div>

              <div className="mt-5 p-4 bg-brand-50 rounded-lg">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Track your product anytime
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <svg className="w-3.5 h-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Easy warranty claims
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                  <svg className="w-3.5 h-3.5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  Fast customer support
                </p>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-primary px-6 text-sm"
                  style={{ backgroundColor: shop.brandColor }}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Step 2: Your Information */}
            <div className={step !== 2 ? "hidden" : undefined}>
              <p className="section-title">Your Information</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="customerName" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
                    <input type="text" id="customerName" name="customerName" className="input-field" required placeholder="John Doe" />
                    {errors.customerName && <p className="text-red-500 text-sm mt-1.5">{errors.customerName}</p>}
                  </div>
                  <div>
                    <label htmlFor="customerEmail" className="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
                    <input type="email" id="customerEmail" name="customerEmail" className="input-field" required placeholder="john@example.com" />
                    {errors.customerEmail && <p className="text-red-500 text-sm mt-1.5">{errors.customerEmail}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                  <input type="tel" id="customerPhone" name="customerPhone" className="input-field" placeholder="+1 (555) 000-0000" />
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <button type="button" onClick={() => setStep(1)} className="btn-outline px-6 text-sm">
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="btn-primary px-6 text-sm"
                  style={{ backgroundColor: shop.brandColor }}
                >
                  Next
                </button>
              </div>
            </div>

            {/* Step 3: Purchase & Confirm */}
            <div className={step !== 3 ? "hidden" : undefined}>
              <p className="section-title">Purchase Details</p>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1.5">Serial Number</label>
                    <input type="text" id="serialNumber" name="serialNumber" className="input-field" placeholder="Found on packaging" />
                    {errors.serialNumber && <p className="text-red-500 text-sm mt-1.5">{errors.serialNumber}</p>}
                  </div>
                  <div>
                    <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Date *</label>
                    <input type="date" id="purchaseDate" name="purchaseDate" className="input-field" required max={new Date().toISOString().split("T")[0]} />
                    {errors.purchaseDate && <p className="text-red-500 text-sm mt-1.5">{errors.purchaseDate}</p>}
                  </div>
                </div>
                <div>
                  <label htmlFor="purchaseChannel" className="block text-sm font-medium text-gray-700 mb-1.5">Where did you purchase? *</label>
                  <select id="purchaseChannel" name="purchaseChannel" className="input-field" required>
                    <option value="SHOPIFY">Online Store</option>
                    <option value="AMAZON">Amazon</option>
                    <option value="RETAIL">Retail Store</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <p className="section-title">Confirmation</p>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                  <input type="checkbox" id="consent" name="consent" className="checkbox-brand mt-0.5" required />
                  <label htmlFor="consent" className="text-sm text-gray-600 leading-relaxed">
                    I agree to the storage and processing of my data for warranty purposes. I can request deletion at any time.
                  </label>
                </div>
                {errors.consent && <p className="text-red-500 text-sm mt-1.5">{errors.consent}</p>}
              </div>

              <div className="flex justify-between mt-6">
                <button type="button" onClick={() => setStep(2)} className="btn-outline px-6 text-sm">
                  Back
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 text-sm"
                  disabled={isSubmitting}
                  style={{ backgroundColor: shop.brandColor }}
                >
                  {isSubmitting ? "Activating..." : "Activate Warranty"}
                </button>
              </div>
            </div>
          </Form>
        </div>

        {/* Footer — hidden for Pro plan (white-label) */}
        {!whiteLabel && (
          <div className="flex items-center justify-center gap-1.5 mt-8 py-4">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-gray-400 tracking-wide">Secured by <span className="text-brand-600 font-medium">Registerly</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
