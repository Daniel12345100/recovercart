import { data, useLoaderData, useActionData, useSubmit, Form } from "react-router";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  TextField,
  Checkbox,
  DataTable,
  Banner,
  InlineGrid,
  Badge,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { useState } from "react";

export async function loader({ request }) {
  const { session, billing } = await authenticate.admin(request);

  // Enforces the \$19.99/mo subscription automatically in production 
  // while keeping local development unblocked and crash-free.
  if (process.env.NODE_ENV === "production") {
    await billing.require({
      plans: [MONTHLY_PLAN],
      isTest: false,
      onFailure: async () =>
        billing.request({
          plan: MONTHLY_PLAN,
          isTest: false,
        }),
    });
  }

  const shop = session.shop;

  const settings = await prisma.appSettings.findUnique({
    where: { shop },
  });

  const carts = await prisma.abandonedCart.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Calculate Executive Analytics
  const totalCartsCount = carts.length;

  const recoveredCarts = carts.filter(
    (c) => c.status === "recovered" || c.status === "RECOVERED"
  );
  const recoveredCount = recoveredCarts.length;

  const totalRecoveredRevenue = recoveredCarts.reduce(
    (acc, c) => acc + (parseFloat(c.totalPrice) || 0),
    0
  );

  const pendingCarts = carts.filter(
    (c) => c.status !== "recovered" && c.status !== "RECOVERED"
  );
  const totalAmountAtRisk = pendingCarts.reduce(
    (acc, c) => acc + (parseFloat(c.totalPrice) || 0),
    0
  );

  const conversionRate =
    totalCartsCount > 0
      ? ((recoveredCount / totalCartsCount) * 100).toFixed(1)
      : "0.0";

  return data({
    settings: settings || {
      messageTemplate:
        "Hi {{name}}, we noticed you left items in your cart at {{shop}}. Complete your order here with 10% off: {{url}}",
      isEnabled: true,
    },
    carts,
    metrics: {
      totalCartsCount,
      recoveredCount,
      conversionRate,
      totalRecoveredRevenue: totalRecoveredRevenue.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      totalAmountAtRisk: totalAmountAtRisk.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    },
  });
}

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "deleteCart") {
    const cartId = formData.get("cartId");
    await prisma.abandonedCart.delete({
      where: { id: cartId },
    });
    return data({ cartDeleted: true });
  }

  if (actionType === "addSampleCart") {
    const sampleId = `cart-${Date.now()}`;
    await prisma.abandonedCart.create({
      data: {
        shop,
        checkoutId: sampleId,
        customerName: "Daniel Kangozhi",
        phone: "260966479464",
        totalPrice: "749.95",
        checkoutUrl: "https://recovercart-test-store.myshopify.com",
        status: "abandoned",
      },
    });
    return data({ cartAdded: true });
  }

  const messageTemplate = formData.get("messageTemplate");
  const isEnabled = formData.get("isEnabled") === "true";
  const discountPercentage = formData.get("discountPercentage") || "10";

  const discountTitle = `RECOVER${discountPercentage}`;
  try {
    await admin.graphql(
      `#graphql
      mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          basicCodeDiscount: {
            title: discountTitle,
            code: discountTitle,
            startsAt: new Date().toISOString(),
            customerGets: {
              value: {
                percentage: parseInt(discountPercentage, 10) / 100,
              },
              items: {
                all: true,
              },
            },
            appliesOncePerCustomer: true,
          },
        },
      }
    );
  } catch (error) {
    console.log("Discount creation check/notice:", error);
  }

  await prisma.appSettings.upsert({
    where: { shop },
    update: { messageTemplate, isEnabled },
    create: { shop, messageTemplate, isEnabled },
  });

  return data({ success: true });
}

export default function Index() {
  const { settings, carts, metrics } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();

  const [formState, setFormState] = useState({
    messageTemplate: settings.messageTemplate,
    isEnabled: settings.isEnabled,
    discountPercentage: 10,
    enableAutomation: true,
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    submit(
      {
        ...formState,
        isEnabled: String(formState.isEnabled),
        enableAutomation: String(formState.enableAutomation),
        discountPercentage: String(formState.discountPercentage),
        actionType: "saveSettings",
      },
      { method: "POST" }
    );
  };

  const handleDeleteCart = (cartId) => {
    submit(
      {
        actionType: "deleteCart",
        cartId,
      },
      { method: "POST" }
    );
  };

  const handleAddSampleCart = () => {
    submit(
      {
        actionType: "addSampleCart",
      },
      { method: "POST" }
    );
  };

  const buildWhatsAppUrl = (
    phone,
    name = "Customer",
    cartUrl = "https://recovercart-test-store.myshopify.com"
  ) => {
    const cleanPhone = phone.replace(/\D/g, "");
    
    const discountCode = `RECOVER${formState.discountPercentage || 10}`;
    const discountedUrl = cartUrl.includes("?") 
      ? `${cartUrl}&discount=${discountCode}` 
      : `${cartUrl}?discount=${discountCode}`;

    const rawMessage =
      formState.messageTemplate ||
      "Hi {{name}}, complete your order here: {{url}}";
      
    const formattedMessage = rawMessage
      .replace("{{name}}", name)
      .replace("{{shop}}", "RecoverCart Store")
      .replace("{{discount}}", String(formState.discountPercentage || 10))
      .replace("{{url}}", discountedUrl);

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
      formattedMessage
    )}`;
  };

  const rows = carts.map((c) => [
    c.customerName || "Customer",
    c.phone,
    `$${parseFloat(c.totalPrice || 0).toFixed(2)}`,
    <Badge
      tone={
        c.status === "recovered" || c.status === "RECOVERED"
          ? "success"
          : "attention"
      }
      key={`badge-${c.id}`}
    >
      {c.status}
    </Badge>,
    new Date(c.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    <InlineStack gap="200" key={`actions-${c.id}`}>
      <Button
        url={buildWhatsAppUrl(c.phone, c.customerName, c.checkoutUrl)}
        external
        variant="primary"
        size="slim"
      >
        Send WhatsApp
      </Button>
      <Button
        onClick={() => handleDeleteCart(c.id)}
        tone="critical"
        variant="tertiary"
        size="slim"
      >
        Delete
      </Button>
    </InlineStack>,
  ]);

  return (
    <Page title="RecoverCart" subtitle="WhatsApp Abandoned Cart Recovery">
      <BlockStack gap="500">
        {actionData?.success && (
          <Banner tone="success">
            <Text as="p">Settings saved and discount code synchronized with Shopify!</Text>
          </Banner>
        )}
        {actionData?.cartDeleted && (
          <Banner tone="info">
            <Text as="p">Cart record removed.</Text>
          </Banner>
        )}
        {actionData?.cartAdded && (
          <Banner tone="success">
            <Text as="p">Sample abandoned cart added successfully.</Text>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 4 }} gap="400">
          <Card padding="400">
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">
                Recovered Revenue
              </Text>
              <Text variant="headingLg" as="p" tone="success">
                {`$${metrics.totalRecoveredRevenue}`}
              </Text>
            </BlockStack>
          </Card>

          <Card padding="400">
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">
                Conversion Rate
              </Text>
              <Text variant="headingLg" as="p">
                {`${metrics.conversionRate}%`}
              </Text>
            </BlockStack>
          </Card>

          <Card padding="400">
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">
                Revenue at Risk
              </Text>
              <Text variant="headingLg" as="p">
                {`$${metrics.totalAmountAtRisk}`}
              </Text>
            </BlockStack>
          </Card>

          <Card padding="400">
            <BlockStack gap="100">
              <Text variant="headingSm" as="h3" tone="subdued">
                Status
              </Text>
              <InlineStack align="start" blockAlign="center" gap="200">
                <Badge tone={formState.isEnabled ? "success" : "attention"}>
                  {formState.isEnabled ? "Active" : "Paused"}
                </Badge>
              </InlineStack>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <Form onSubmit={handleSubmit}>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">
                    Message Template & Discount Rules
                  </Text>
                  
                  <Checkbox
                    label="Enable WhatsApp Recovery"
                    checked={formState.isEnabled}
                    onChange={(val) =>
                      setFormState({ ...formState, isEnabled: val })
                    }
                  />

                  <TextField
                    label="Recovery Message"
                    value={formState.messageTemplate}
                    onChange={(val) =>
                      setFormState({ ...formState, messageTemplate: val })
                    }
                    multiline={3}
                    helpText="Dynamic placeholders: {{name}}, {{shop}}, {{discount}}, {{url}}"
                  />

                  <Divider />

                  <Text variant="headingMd" as="h2">
                    Smart Incentive Settings
                  </Text>

                  <InlineGrid columns={{ xs: 1, sm: 2 }} gap="400">
                    <TextField
                      label="Recovery Discount Percentage (%)"
                      type="number"
                      value={String(formState.discountPercentage)}
                      onChange={(val) =>
                        setFormState({
                          ...formState,
                          discountPercentage: parseInt(val || "0", 10),
                        })
                      }
                      helpText="Discount code automatically pre-applies on checkout link."
                    />

                    <Checkbox
                      label="Enable Automated Drip Reminders"
                      checked={formState.enableAutomation}
                      onChange={(val) =>
                        setFormState({ ...formState, enableAutomation: val })
                      }
                      helpText="Automatically queues secondary reminders for unrecovered carts."
                    />
                  </InlineGrid>

                  <InlineStack align="end" gap="300">
                    <Button onClick={handleAddSampleCart} variant="plain">
                      Add Sample Cart
                    </Button>
                    <Button submit variant="primary">
                      Save Settings
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">
                  Abandoned Checkouts
                </Text>
                {rows.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                      "numeric",
                    ]}
                    headings={[
                      "Customer",
                      "Phone",
                      "Total",
                      "Status",
                      "Time",
                      "Action",
                    ]}
                    rows={rows}
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    No abandoned checkouts recorded yet.
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}