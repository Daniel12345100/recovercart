import prisma from "../db.server";

export async function action({ request }) {
  try {
    const rawBody = await request.text();
    if (!rawBody) {
      return new Response(JSON.stringify({ message: "Empty body" }), { status: 200 });
    }

    const topic = (request.headers.get("x-shopify-topic") || "").toLowerCase().replace("_", "/");
    const shop = request.headers.get("x-shopify-shop-domain") || "recovercart-test-store.myshopify.com";

    // CRITICAL: Immediately acknowledge mandatory privacy compliance webhooks with 200 OK
    if (
      topic === "shop/redact" ||
      topic === "customers/data_request" ||
      topic === "customers/redact" ||
      topic === "privacy/customers_data_request" ||
      topic === "privacy/customers_redact" ||
      topic === "privacy/shop_redact"
    ) {
      console.log(`[RecoverCart] Acknowledged compliance webhook [${topic}] for ${shop}`);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("[RecoverCart Webhook] Failed to parse JSON body");
      return new Response("Invalid JSON", { status: 400 });
    }

    const customerName = payload.customer 
      ? `${payload.customer.first_name || ""} ${payload.customer.last_name || ""}`.trim() 
      : payload.billing_address?.name || "Valued Customer";
    
    const customerEmail = payload.email || payload.contact_email || "test@example.com";
    const customerPhone = payload.phone || payload.shipping_address?.phone || payload.billing_address?.phone || "+1234567890";
    const totalPrice = payload.total_price || "0.00";
    const currency = payload.currency || "USD";

    const lineItems = payload.line_items 
      ? JSON.stringify(payload.line_items.map(item => ({ title: item.title, quantity: item.quantity })))
      : JSON.stringify([{ title: "Store Product", quantity: 1 }]);

    const checkoutId = String(payload.id || payload.token || Date.now());

    await prisma.abandonedCart.upsert({
      where: { id: checkoutId },
      update: {
        shop,
        customerName,
        customerEmail,
        customerPhone,
        totalPrice,
        currency,
        lineItems,
        updatedAt: new Date(),
      },
      create: {
        id: checkoutId,
        shop: shop,
        customerName,
        customerEmail,
        customerPhone,
        totalPrice,
        currency,
        lineItems,
        recovered: false,
      },
    });

    console.log(`[RecoverCart] Successfully processed webhook cart ${checkoutId} for ${shop}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[RecoverCart Webhook Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}