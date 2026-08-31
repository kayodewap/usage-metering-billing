import { getBillingSummary } from "./billing-service.js";

try {
  const billing = await getBillingSummary(8);

  console.log("Billing summary:");
  console.dir(billing, { depth: null });
} catch (error) {
  console.error("Failed:", error.message);
}