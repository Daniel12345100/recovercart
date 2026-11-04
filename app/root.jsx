import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  useLoaderData,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as PolarisAppProvider } from "@shopify/polaris";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

export function links() {
  return [{ rel: "stylesheet", href: polarisStyles }];
}

export async function loader({ request }) {
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
}

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <ShopifyAppProvider embedded apiKey={apiKey}>
          <PolarisAppProvider i18n={polarisTranslations}>
            <Outlet />
          </PolarisAppProvider>
        </ShopifyAppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}