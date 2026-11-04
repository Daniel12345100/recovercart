import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  try {
    console.log("Received order webhook trigger");

    // 1. Authenticate incoming webhook from Shopify
    const { topic, shop, payload } = await authenticate.webhook(request);
    console.log(`Webhook triggered: ${topic} for ${shop}`);

    // Extract potential match fields from order payload
    const customerPhone =
      payload?.phone ||
      payload?.customer?.phone ||
      payload?.billing_address?.phone ||
      payload?.shipping_address?.phone ||
      "";

    let targetCart = null;

    // 2. Try to find matching cart by phone number first
    if (customerPhone) {
      targetCart = await prisma.abandonedCart.findFirst({
        where: {
          shop,
          phone: customerPhone,
          status: { in: ["PENDING", "SENT", "abandoned"] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // 3. Fallback: Find latest pending/sent/abandoned cart if phone match wasn't found
    if (!targetCart) {
      targetCart = await prisma.abandonedCart.findFirst({
        where: {
          shop,
          status: { in: ["PENDING", "SENT", "abandoned"] },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    // 4. Update status to RECOVERED and timestamp
    if (targetCart) {
      await prisma.abandonedCart.update({
        where: { id: targetCart.id },
        data: {
          status: "RECOVERED",
          recoveredAt: new Date(),
          recoverySource: "WHATSAPP",
        },
      });
      console.log(`Successfully updated cart ID: ${targetCart.id} to RECOVERED`);
    }

    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Order webhook processing failed:", error);
    // Return 200 so Shopify doesn't fail webhook delivery during testing
    return new Response("OK", { status: 200 });
  }
};