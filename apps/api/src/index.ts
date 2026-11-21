import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();
createApp().listen(config.API_PORT, () => {
  console.info(`API listening on http://localhost:${config.API_PORT}`);
});
