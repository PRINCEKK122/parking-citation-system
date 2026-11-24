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
import { RegisterPage, SignInPage } from "./pages/auth/AuthPages.js";
import { registerAction, signInAction, signOutAction } from "./pages/auth/actions.js";
import { AccountPage } from "./pages/account/AccountPage.js";
import { accountAction, accountLoader } from "./pages/account/data.js";
import { ROOT_ROUTE_ID, rootLoader, rootShouldRevalidate } from "./session.js";
import { StaffPage } from "./pages/staff/StaffPage.js";
import { staffAction, staffLoader } from "./pages/staff/data.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

export { paths } from "./paths.js";

export const routes: RouteObject[] = [
  {
    id: ROOT_ROUTE_ID,
    path: "/",
    loader: rootLoader,
    shouldRevalidate: rootShouldRevalidate,
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
      { path: "sign-in", element: <SignInPage />, action: signInAction },
      { path: "register", element: <RegisterPage />, action: registerAction },
      { path: "sign-out", action: signOutAction },
      { path: "account", element: <AccountPage />, loader: accountLoader, action: accountAction },
      { path: "staff", element: <StaffPage />, loader: staffLoader, action: staffAction },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
