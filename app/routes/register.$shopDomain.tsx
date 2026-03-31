import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import React, { useState } from "react";
import { z } from "zod";
import prisma from "~/db.server";
import { createRegistration } from "~/services/registration.server";
import { checkRegistrationLimit, incrementRegistrationCount } from "~/services/billing.server";
import { rateLimitMiddleware } from "~/services/ratelimit.server";
import { sendEmail } from "~/services/email.server";
import tailwindStyles from "~/styles/tailwind.css?url";

export const links = () => [{ rel: "stylesheet", href: tailwindStyles }];

const registrationSchema = z.object({
  productId: z.string().min(1, "Please select a product"),
  customerName: z.string().min(2, "Name must be at least 2 characters"),
  customerEmail: z.string().email("Please enter a valid email"),
  customerPhone: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().min(1, "Please enter a purchase date"),
  purchaseChannel: z.enum(["SHOPIFY", "AMAZON", "RETAIL", "OTHER"]),
  consent: z.literal("on", { errorMap: () => ({ message: "You must agree to the terms" }) }),
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) throw new Response("Shop not found", { status: 404 });

  const shop = await prisma.shop.findUnique({
    where: { domain: shopDomain },
    include: {
      products: { where: { isActive: true }, orderBy: { name: "asc" } },
    },
  });

  if (!shop) throw new Response("Shop not found", { status: 404 });

  const url = new URL(request.url);
  const preselectedProduct = url.searchParams.get("product");

  return json({
    shop: { domain: shop.domain, brandColor: shop.brandColor, brandLogo: shop.brandLogo },
    products: shop.products.map((p) => ({
      id: p.id,
      name: p.name,
      warrantyMonths: p.warrantyMonths,
      requireSerialNumber: p.requireSerialNumber,
    })),
    preselectedProduct,
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const shopDomain = params.shopDomain;
  if (!shopDomain) throw new Response("Shop not found", { status: 404 });

  // IP-based rate limiting: 10 submissions per minute per IP
  const rl = rateLimitMiddleware(request, { maxRequests: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return json(
      { errors: { _form: "Too many requests. Please wait a moment before trying again." } },
      { status: 429, headers: rl.headers },
    );
  }

  const shop = await prisma.shop.findUnique({ where: { domain: shopDomain } });
  if (!shop) throw new Response("Shop not found", { status: 404 });

  // Check registration limit
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
      purchaseDate: new Date(parsed.data.purchaseDate),
      purchaseChannel: parsed.data.purchaseChannel,
      consentGiven: true,
    });

    await incrementRegistrationCount(shop.id);

    // Send confirmation email
    try {
      await sendEmail({
        to: registration.customerEmail,
        shopId: shop.id,
        templateType: "REGISTRATION_CONFIRM",
        variables: {
          customerName: registration.customerName,
          productName: registration.product.name,
          serialNumber: registration.serialNumber || "N/A",
          warrantyExpiry: registration.warrantyExpiresAt?.toLocaleDateString() || "N/A",
          portalUrl: `${process.env.APP_URL}/portal/${registration.id}`,
        },
      });
    } catch (e) {
      console.error("Failed to send registration email:", e);
    }

    return redirect(`/portal/${registration.id}?registered=true`);
  } catch (error: any) {
    return json({ errors: { _form: error.message } }, { status: 400 });
  }
};

export default function RegisterPage() {
  const { shop, products, preselectedProduct } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const errors = (actionData as any)?.errors || {};
  const [step, setStep] = useState(1);

  const stepLabels = ["Choose your product", "Tell us about yourself", "Complete registration"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Colored Hero Header */}
      <div className="hero-section">
        <div className="max-w-xl mx-auto px-4 pt-12 pb-20 sm:pt-16 sm:pb-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 bg-white/15 backdrop-blur-sm">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Register Your Product</h1>
          <p className="text-brand-200 mt-2 text-base">Get warranty protection in 60 seconds</p>
          {step === 1 && (
            <div className="flex flex-col items-center gap-1 mt-3">
              <span className="text-brand-200 text-sm flex items-center gap-2">&#10003; Track your product anytime</span>
              <span className="text-brand-200 text-sm flex items-center gap-2">&#10003; Easy warranty claims</span>
              <span className="text-brand-200 text-sm flex items-center gap-2">&#10003; Fast customer support</span>
            </div>
          )}
        </div>
      </div>

      {/* Form Card - pulled up into hero */}
      <div className="max-w-xl mx-auto px-4 -mt-12 sm:-mt-16 pb-10">
        <div className="card shadow-lg">
          {errors._form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <span>{errors._form}</span>
            </div>
          )}

          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-4">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step > s ? 'bg-brand-600 text-white' : step === s ? 'bg-brand-600 text-white ring-4 ring-brand-100' : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  ) : s}
                </div>
                {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-brand-600' : 'bg-gray-200'}`} />}
              </React.Fragment>
            ))}
          </div>

          {/* Step Label */}
          <p className="text-center text-sm font-medium text-gray-500 mb-8">{stepLabels[step - 1]}</p>

          <Form method="post" className="space-y-8">
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
                      {p.name} ({p.warrantyMonths} months warranty)
                    </option>
                  ))}
                </select>
                {errors.productId && <p className="text-red-500 text-sm mt-1.5">{errors.productId}</p>}
              </div>

              {/* Step 1 Navigation */}
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

              {/* Step 2 Navigation */}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
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

              {/* Confirmation */}
              <div className="mt-6">
                <p className="section-title">Confirmation</p>
                <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl">
                  <input type="checkbox" id="consent" name="consent" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" required />
                  <label htmlFor="consent" className="text-sm text-gray-600 leading-relaxed">
                    I agree to the storage and processing of my data for warranty purposes. I can request deletion at any time.
                  </label>
                </div>
                {errors.consent && <p className="text-red-500 text-sm mt-1.5">{errors.consent}</p>}
              </div>

              {/* Step 3 Navigation */}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-6 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
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

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-8">
          <svg className="w-3.5 h-3.5 text-brand-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xs text-gray-400">Secured by <span className="text-brand-600 font-medium">Registerly</span></p>
        </div>
      </div>
    </div>
  );
}
