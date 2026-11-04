import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    // 1. Fetch enabled app settings (without filtering enableAutomation directly in query to avoid un-generated client error)
    const settingsList = await prisma.appSettings.findMany({
      where: {
        isEnabled: true,
      },
    });

    // Safe in-memory filter for automation toggle
    const activeSettings = settingsList.filter((s) => Boolean(s.enableAutomation));

    if (!activeSettings || activeSettings.length === 0) {
      return new Response(
        JSON.stringify({ status: "skipped", message: "Automated drip sequences disabled." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    let totalProcessed = 0;

    for (const setting of activeSettings) {
      // 2. Fetch carts for active shop
      const pendingCarts = await prisma.abandonedCart.findMany({
        where: {
          shop: setting.shop,
          status: { in: ["abandoned", "PENDING"] },
        },
      });

      // Filter carts that need reminders
      const targetCarts = pendingCarts.filter(
        (c) => (!c.reminderCount || c.reminderCount === 0)
      );

      for (const cart of targetCarts) {
        const baseCheckoutUrl = cart.checkoutUrl || `https://${setting.shop}`;
        const discountCode = `RECOVER${setting.discountPercentage || 10}`;
        const discountedUrl = baseCheckoutUrl.includes("?")
          ? `${baseCheckoutUrl}&discount=${discountCode}`
          : `${baseCheckoutUrl}?discount=${discountCode}`;

        const rawTemplate =
          setting.messageTemplate ||
          "Hi {{name}}, complete your order here: {{url}}";

        const formattedMessage = rawTemplate
          .replace("{{name}}", cart.customerName || "Customer")
          .replace("{{shop}}", "RecoverCart Store")
          .replace("{{discount}}", String(setting.discountPercentage || 10))
          .replace("{{url}}", discountedUrl);

        console.log(`[AUTOMATION CRON] Drip message processed for ${cart.phone}: ${formattedMessage}`);

        // Update cart reminder count safely
        await prisma.abandonedCart.update({
          where: { id: cart.id },
          data: {
            status: "SENT",
          },
        });

        totalProcessed++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, processedCount: totalProcessed }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Cron automation processing error:", error);
    return new Response(
      JSON.stringify({ error: "Automation failed to process", details: String(error) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};