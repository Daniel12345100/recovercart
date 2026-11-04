import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export async function action({ request }) {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`[GDPR Webhook Received] Topic: ${topic} for shop: ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      break;

    case "CUSTOMERS_REDACT":
      if (payload.customer && payload.customer.email) {
        await prisma.abandonedCart.deleteMany({
          where: {
            shop,
            customerEmail: payload.customer.email,
          },
        });
      }
      break;

    case "SHOP_REDACT":
      await prisma.abandonedCart.deleteMany({ where: { shop } });
      await prisma.storeSetting.deleteMany({ where: { shop } });
      break;

    default:
      console.warn(`Unhandled GDPR webhook topic: ${topic}`);
  }

  return new Response(null, { status: 200 });
}