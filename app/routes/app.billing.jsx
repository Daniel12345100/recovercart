import { data, useLoaderData, useFetcher } from "react-router";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import { Page, Layout, Text, Card, Button, BlockStack, Banner } from "@shopify/polaris";

export async function loader({ request }) {
  const { billing } = await authenticate.admin(request);

  try {
    const billingCheck = await billing.check({
      plans: [MONTHLY_PLAN],
      isTest: true,
    });

    return data({ hasActivePayment: billingCheck.hasActivePayment });
  } catch (error) {
    return data({ hasActivePayment: false, error: error.message });
  }
}

export async function action({ request }) {
  const { billing } = await authenticate.admin(request);

  // When the merchant clicks "Approve", explicitly request the billing charge
  throw await billing.request({
    plan: MONTHLY_PLAN,
    isTest: true,
  });
}

export default function BillingPage() {
  const { hasActivePayment, error } = useLoaderData();
  const fetcher = useFetcher();

  return (
    <Page title="RecoverCart Billing" subtitle="Manage your subscription plan">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {error && (
              <Banner tone="warning">
                <Text as="p">Notice: {error}</Text>
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Monthly Pro Subscription ($19.99/mo)</Text>
                <Text as="p">
                  Includes a 14-day free trial, automated WhatsApp recovery alerts, and real-time revenue tracking.
                </Text>

                {hasActivePayment ? (
                  <Banner tone="success">
                    <Text as="p">✓ Your store has an active subscription to the Monthly Pro Plan.</Text>
                  </Banner>
                ) : (
                  <BlockStack gap="300">
                    <Text tone="attention" as="p">
                      Your store currently does not have an active subscription. Approve the $19.99/mo plan to unlock all features.
                    </Text>
                    <fetcher.Form method="post">
                      <Button submit variant="primary" size="large">
                        Approve Subscription ($19.99/mo)
                      </Button>
                    </fetcher.Form>
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}