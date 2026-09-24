import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DASHBOARD_HTML_PLACEHOLDERS, renderDashboardHtml } from "../src/dashboard/webviewHtml.ts";

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "dashboard-ui", "dashboard.html");
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, renderDashboardHtml(DASHBOARD_HTML_PLACEHOLDERS));
console.log(`written ${outPath}`);
