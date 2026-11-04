import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  try {
    // Authenticate the incoming webhook from Shopify
    const { topic, shop, payload } = await authenticate.webhook(request);
    console.log(`Webhook triggered: ${topic} for ${shop}`);

    const checkoutId = String(payload.id || payload.token || Date.now());
    
    // Fallback extraction for phone and customer name
    const phone =
      payload.phone ||
      payload.billing_address?.phone ||
      payload.shipping_address?.phone ||
      payload.customer?.phone ||
      "";

    const firstName =
      payload.customer?.first_name ||
      payload.billing_address?.first_name ||
      payload.shipping_address?.first_name ||
      "Valued";

    const lastName =
      payload.customer?.last_name ||
      payload.billing_address?.last_name ||
      payload.shipping_address?.last_name ||
      "Customer";

    const customerName = `${firstName} ${lastName}`.trim();
    const totalPrice = String(
      payload.total_price || payload.subtotal_price || "0.00"
    );
    const checkoutUrl =
      payload.abandoned_checkout_url ||
      payload.line_items?.[0]?.url ||
      `https://${shop}`;

    // Upsert the abandoned cart if phone number is present and order is uncompleted
    if (phone && !payload.completed_at) {
      await prisma.abandonedCart.upsert({
        where: { checkoutId },
        update: {
          customerName,
          phone,
          totalPrice,
          checkoutUrl,
          status: "abandoned",
        },
        create: {
          shop,
          checkoutId,
          customerName,
          phone,
          totalPrice,
          checkoutUrl,
          status: "abandoned",
          reminderCount: 0,
        },
      });
      console.log(`Successfully logged abandoned cart for ${customerName}`);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    // Return 200 even on minor errors so Shopify doesn't spam retries during development
    return new Response("OK", { status: 200 });
  }
};