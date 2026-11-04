import prisma from "../db.server";

export async function action({ request }) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const rawBody = await request.text();
    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
    }

    const shop = payload.shop || "recovercart-test-store.myshopify.com";
    const checkoutId = String(payload.id || Date.now());

    // Strict extraction: Only fall back if the value is completely empty/undefined
    const customerName = (payload.customerName && payload.customerName.trim() !== "") 
      ? payload.customerName 
      : "Valued Customer";
      
    const customerEmail = (payload.customerEmail && payload.customerEmail.trim() !== "") 
      ? payload.customerEmail 
      : "No email provided";
      
    const customerPhone = (payload.customerPhone && payload.customerPhone.trim() !== "") 
      ? payload.customerPhone 
      : "";
      
    const totalPrice = String(payload.totalPrice || "0.00");
    const currency = payload.currency || "USD";
    const lineItems = (payload.lineItems && payload.lineItems.length > 0) 
      ? JSON.stringify(payload.lineItems) 
      : JSON.stringify([{ title: "Store Item", quantity: 1 }]);

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
        shop,
        customerName,
        customerEmail,
        customerPhone,
        totalPrice,
        currency,
        lineItems,
        recovered: false,
      },
    });

    return new Response(JSON.stringify({ success: true, id: checkoutId }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error("[RecoverCart Ingestion Error]:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}