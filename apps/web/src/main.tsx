import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { config } from "./config.js";
import { routes } from "./routes.js";
import "./styles/tokens.css";
import "./styles/base.css";

/** Start the mock API before the first render, so no early request reaches the network. */
async function enableMocks() {
  if (!config.useMocks) return;
  const { startMockApi } = await import("./mocks/browser.js");
  await startMockApi();
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

void enableMocks().then(() => {
  const router = createBrowserRouter(routes);
  createRoot(root).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  );
});
