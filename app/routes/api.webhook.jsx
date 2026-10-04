export async function action({ request }) {
  try {
    if (request.method !== "POST") {
      return Response.json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    const payload = await request.json();
    
    const phone = payload.phone || payload.shipping_address?.phone || payload.billing_address?.phone;
    const name = payload.customer?.first_name || payload.billing_address?.first_name || "Valued Customer";
    const checkoutUrl = payload.abandoned_checkout_url || payload.landing_site || "https://nestwellguides.com";

    if (!phone) {
      return Response.json({ success: false, message: "No phone number found in checkout payload." }, { status: 200 });
    }

    const whatsappResponse = await fetch("http://localhost:3002/api/send-whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ phone, name, checkoutUrl }),
    });

    const result = await whatsappResponse.json();
    return Response.json({ success: true, whatsappResult: result });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function loader() {
  return Response.json({ status: "webhook_listener_online" });
}