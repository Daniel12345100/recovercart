import { useState } from "react";
import {
  AppProvider,
  Page,
  Layout,
  Card,
  BlockStack,
  InlineGrid,
  Text,
  Badge,
  DataTable,
  Button,
  TextField,
  Banner,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`
      #graphql
      query getAbandonedCheckouts {
        abandonedCheckouts(first: 10, reverse: true) {
          edges {
            node {
              id
              createdAt
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                displayName
                phone
              }
              lineItems(first: 5) {
                edges {
                  node {
                    title
                    quantity
                  }
                }
              }
              abandonedCheckoutUrl
            }
          }
        }
      }
    `);

    const responseJson = await response.json();
    return { checkouts: responseJson.data?.abandonedCheckouts?.edges || [] };
  } catch (error) {
    console.error("Error fetching checkouts:", error);
    return { checkouts: [] };
  }
};

export default function RecoverCartDashboard(props) {
  const checkouts = props?.loaderData?.checkouts || props?.checkouts || [];

  const [phoneNumber, setPhoneNumber] = useState("+260971234567");
  const [savedBanner, setSavedBanner] = useState(false);
  const [sentCheckoutIds, setSentCheckoutIds] = useState([]);

  const handleSendWhatsApp = (checkoutId, phone, customerName, value, recoveryUrl) => {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, "") : "260971234567";
    const message = encodeURIComponent(
      `Hello ${customerName || "there"}, you left items worth ${value} in your cart. Complete your order here: ${
        recoveryUrl || "https://recovercart-test-store.myshopify.com"
      }`
    );

    if (!sentCheckoutIds.includes(checkoutId)) {
      setSentCheckoutIds((prev) => [...prev, checkoutId]);
    }

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, "_blank");
  };

  const getDemoRow = () => {
    const demoId = "demo-1";
    const isSent = sentCheckoutIds.includes(demoId);
    return [
      "Daniel Kangozhi",
      "1x The Multi-managed Snowboard",
      "$629.95",
      "Just now",
      <Badge key="badge-demo" tone={isSent ? "success" : "attention"}>
        {isSent ? "Message Sent" : "Pending"}
      </Badge>,
      <Button
        key="btn-demo"
        variant={isSent ? "secondary" : "primary"}
        size="slim"
        onClick={() =>
          handleSendWhatsApp(
            demoId,
            "+260971234567",
            "Daniel Kangozhi",
            "$629.95"
          )
        }
      >
        {isSent ? "Resend WhatsApp" : "Send WhatsApp"}
      </Button>,
    ];
  };

  const displayRows =
    checkouts.length > 0
      ? checkouts.map(({ node }) => {
          const customerName = node.customer?.displayName || "Daniel Kangozhi";
          const phone = node.customer?.phone || "+260971234567";
          const cartValue = `${
            node.totalPriceSet?.shopMoney?.currencyCode || "$"
          } ${node.totalPriceSet?.shopMoney?.amount || "629.95"}`;
          const items =
            node.lineItems?.edges
              ?.map(({ node: item }) => `${item.quantity}x ${item.title}`)
              .join(", ") || "1x The Multi-managed Snowboard";
          const time = new Date(node.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          });

          const isSent = sentCheckoutIds.includes(node.id);

          return [
            customerName,
            items,
            cartValue,
            time,
            <Badge key={`badge-${node.id}`} tone={isSent ? "success" : "attention"}>
              {isSent ? "Message Sent" : "Pending"}
            </Badge>,
            <Button
              key={`btn-${node.id}`}
              variant={isSent ? "secondary" : "primary"}
              size="slim"
              onClick={() =>
                handleSendWhatsApp(
                  node.id,
                  phone,
                  customerName,
                  cartValue,
                  node.abandonedCheckoutUrl
                )
              }
            >
              {isSent ? "Resend WhatsApp" : "Send WhatsApp"}
            </Button>,
          ];
        })
      : [getDemoRow()];

  return (
    <AppProvider i18n={enTranslations}>
      <Page title="RecoverCart Dashboard">
        <BlockStack gap="500">
          {savedBanner && (
            <Banner
              title="Settings saved successfully"
              tone="success"
              onDismiss={() => setSavedBanner(false)}
            />
          )}

          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <Card padding="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Abandoned Carts Found
                </Text>
                <Text as="p" variant="headingLg">
                  {checkouts.length || 1}
                </Text>
              </BlockStack>
            </Card>
            <Card padding="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  WhatsApp Messages Sent
                </Text>
                <Text as="p" variant="headingLg">
                  {sentCheckoutIds.length}
                </Text>
              </BlockStack>
            </Card>
            <Card padding="400">
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Recovered Revenue
                </Text>
                <Text as="p" variant="headingLg" tone="success">
                  ${(sentCheckoutIds.length * 629.95).toFixed(2)}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>

          <Layout>
            <Layout.Section>
              <Card padding="0">
                <BlockStack gap="400" padding="400">
                  <Text as="h2" variant="headingMd">
                    Active Abandoned Carts
                  </Text>
                </BlockStack>
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "numeric",
                    "text",
                    "text",
                    "text",
                  ]}
                  headings={[
                    "Customer / Business",
                    "Items",
                    "Cart Value",
                    "Last Active",
                    "Status",
                    "Action",
                  ]}
                  rows={displayRows}
                />
              </Card>
            </Layout.Section>

            <Layout.Section variant="oneThird">
              <Card padding="400">
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    WhatsApp Configuration
                  </Text>
                  <TextField
                    label="Store Support WhatsApp Number"
                    value={phoneNumber}
                    onChange={(val) => setPhoneNumber(val)}
                    helpText="Number used as the sender for manual recovery links."
                    autoComplete="off"
                  />
                  <Button onClick={() => setSavedBanner(true)}>
                    Save Settings
                  </Button>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Page>
    </AppProvider>
  );
}