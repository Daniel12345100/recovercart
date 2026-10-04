export async function action({ request }) {
  try {
    let phone = "260966479464";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body.phone) phone = body.phone;
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      if (formData.get("phone")) phone = formData.get("phone");
    }

    const formattedPhone = phone.toString().replace("+", "").trim();
    const token = "EAAT0nnnVCVMBSnC5r460lyg8L5tVRZCvGxheFloV4XNYa1qMiWB5WvqD70tzZCLIsPBlk3vN3x6o33XYeBsIJyL0l8BwKlc3ub1OdBiPPYktDxttOsMhcTVmQXBMvsuLqnJAZCZBicQ4jQW5R36pYMmHD1NQt08bgijBh0bgSuqZAflihv473JuJXVw6qLQZDZD";
    const response = await fetch(
      `https://graph.facebook.com/v22.0/1339169802615488/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: formattedPhone,
          type: "template",
          template: {
            name: "hello_world",
            language: { code: "en_US" },
          },
        }),
      }
    );

    const data = await response.json();
    return Response.json({ success: response.ok, data });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}