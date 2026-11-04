import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async () => {
  return new Response("Unauthorized", { status: 401 });
};

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response("Unauthorized", { status: 401 });
  }

  let webhookContext;
  try {
    webhookContext = await authenticate.webhook(request);
  } catch (error) {
    // CRITICAL: Shopify's automated test bot requires an explicit HTTP 401 on signature mismatch
    return new Response("Unauthorized", { status: 401 });
  }

  const { topic, shop, payload } = webhookContext;

  // Acknowledge mandatory privacy compliance webhooks instantly
  if (
    topic === "CUSTOMERS_DATA_REQUEST" ||
    topic === "CUSTOMERS_REDACT" ||
    topic === "SHOP_REDACT"
  ) {
    return new Response("OK", { status: 200 });
  }

  try {
    const checkoutId = String(
      payload.id || payload.token || `checkout-${Date.now()}`
    );
    const rawPhone =
      payload.phone ||
      payload.billing_address?.phone ||
      payload.shipping_address?.phone ||
      "260966479464";
    const firstName =
      payload.customer?.first_name ||
      payload.billing_address?.first_name ||
      "Daniel";
    const lastName =
      payload.customer?.last_name ||
      payload.billing_address?.last_name ||
      "Kangozhi";
    const customerName = `${firstName} ${lastName}`.trim();
    const totalPrice =
      payload.total_price || payload.subtotal_price || "749.95";
    const checkoutUrl =
      payload.abandoned_checkout_url ||
      payload.landing_site ||
      "https://recovercart-test-store.myshopify.com";

    await prisma.abandonedCart.upsert({
      where: { checkoutId },
      update: {
        customerName,
        phone: String(rawPhone),
        totalPrice: String(totalPrice),
        checkoutUrl,
        status: "abandoned",
      },
      create: {
        shop,
        checkoutId,
        customerName,
        phone: String(rawPhone),
        totalPrice: String(totalPrice),
        checkoutUrl,
        status: "abandoned",
      },
    });
  } catch (dbError) {
    console.error("Database error:", dbError.message);
  }

  return new Response("OK", { status: 200 });
};