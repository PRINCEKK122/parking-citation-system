import type { RouteObject } from "react-router";
import { AppLayout } from "./layout/AppLayout.js";
import { RouteError } from "./layout/RouteError.js";
import { LookupPage } from "./pages/LookupPage.js";
import { ResultsPage } from "./pages/ResultsPage.js";
import { CheckoutPage } from "./pages/CheckoutPage.js";
import { PaymentStatusPage } from "./pages/PaymentStatusPage.js";
import { SignInPage } from "./pages/SignInPage.js";
import { AccountPage } from "./pages/AccountPage.js";
import { StaffPage } from "./pages/StaffPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";

/** URL builders, so pages never hand-assemble paths. */
export const paths = {
  lookup: () => "/",
  results: (q: string, state?: string) =>
    `/results?${new URLSearchParams(state ? { q, state } : { q }).toString()}`,
  checkout: (citationId: string) => `/pay/${encodeURIComponent(citationId)}`,
  paymentStatus: (paymentId: string) => `/payments/${encodeURIComponent(paymentId)}`,
  signIn: () => "/sign-in",
  account: () => "/account",
  staff: () => "/staff",
};

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <LookupPage /> },
      { path: "results", element: <ResultsPage /> },
      { path: "pay/:citationId", element: <CheckoutPage /> },
      { path: "payments/:paymentId", element: <PaymentStatusPage /> },
      { path: "sign-in", element: <SignInPage /> },
      { path: "account", element: <AccountPage /> },
      { path: "staff", element: <StaffPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];
