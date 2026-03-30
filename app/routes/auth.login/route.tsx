import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useLoaderData } from "@remix-run/react";
import { login } from "~/shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const errors = { shop: url.searchParams.get("error") };
  return json({ errors, polarisTranslations: {} });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = await login(request);
  return json(errors);
};

export default function LoginPage() {
  const { errors } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const allErrors = { ...errors, ...((actionData as any)?.errors || {}) };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f6f6f7" }}>
      <div style={{ maxWidth: 400, width: "100%", padding: 32, background: "white", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, textAlign: "center" }}>Registerly</h1>
        <Form method="post">
          <label htmlFor="shop" style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500 }}>Shop domain</label>
          <input
            type="text"
            name="shop"
            id="shop"
            placeholder="my-shop.myshopify.com"
            style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 8, fontSize: 14, marginBottom: 8 }}
          />
          {allErrors.shop && <p style={{ color: "red", fontSize: 12 }}>{allErrors.shop}</p>}
          <button
            type="submit"
            style={{ width: "100%", marginTop: 16, padding: 12, background: "#2563eb", color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            Log in
          </button>
        </Form>
      </div>
    </div>
  );
}
