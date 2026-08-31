import express from "express";
import tenantRoutes from "./routes/tenant-routes.js";
import usageRoutes from "./routes/usage-routes.js";
import subscriptionRoutes from "./routes/subscription-routes.js";
import billingRoutes from "./routes/billing-routes.js";
import stripeWebhookRoutes from "./routes/stripe-webhook-routes.js";
import invoiceRoutes from "./routes/invoice-routes.js";

const app = express();

app.use("/webhooks/stripe", stripeWebhookRoutes);
app.use(express.json());
app.use("/tenants", tenantRoutes);
app.use("/usage", usageRoutes);
app.use("/subscriptions", subscriptionRoutes);
app.use("/billing", billingRoutes);
app.use("/invoices", invoiceRoutes);


app.get("/health", (req, res) => {
  res.json({
    status: true,
    message: "API is running",
  });
});

export default app;