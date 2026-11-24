import type { RouteObject } from "react-router";
import { AppLayout } from "./layout/AppLayout.js";
import { RouteError } from "./layout/RouteError.js";
import { AppLoading } from "./layout/AppLoading.js";
import { LookupPage } from "./pages/LookupPage.js";
import { ResultsPage } from "./pages/results/ResultsPage.js";
import { resultsLoader } from "./pages/results/loader.js";
import { CheckoutPage } from "./pages/checkout/CheckoutPage.js";
import { checkoutLoader } from "./pages/checkout/loader.js";
import { PaymentStatusPage } from "./pages/payment/PaymentStatusPage.js";
import { paymentLoader } from "./pages/payment/loader.js";
import { SignInPage } from "./pages/SignInPage.js";
import { AccountPage } from "./pages/AccountPage.js";
import { StaffPage } from "./pages/StaffPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export { paths } from "./paths.js";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    children: [
      { index: true, element: <LookupPage /> },
      {
        path: "results",
        element: <ResultsPage />,
        loader: resultsLoader,
      },
      { path: "pay/:citationId", element: <CheckoutPage />, loader: checkoutLoader },
      { path: "payments/:paymentId", element: <PaymentStatusPage />, loader: paymentLoader },
      { path: "sign-in", element: <SignInPage /> },
      { path: "account", element: <AccountPage /> },
      { path: "staff", element: <StaffPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
