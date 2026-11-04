export async function action({ request }) {
  if (request.method !== "POST") {
    return Response.json({ message: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await request.json();
    const phone = data.phone || "260971234567";
    const customerName = data.customerName || "Valued Customer";
    const itemName = data.itemName || "your items";

    const message = encodeURIComponent(
      `Hi ${customerName}, we noticed you left ${itemName} in your cart at RecoverCart. Click here to complete your order!`
    );

    const whatsappUrl = `https://wa.me/${phone.replace(/[^0-9]/g, "")}?text=${message}`;

    return Response.json({ success: true, url: whatsappUrl });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}