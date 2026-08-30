import express from "express";
import tenantRoutes from "./routes/tenant-routes.js";
import usageRoutes from "./routes/usage-routes.js";

const app = express();

app.use(express.json());

app.use("/tenants", tenantRoutes);
app.use("/usage", usageRoutes);

app.get("/health", (req, res) => {
  res.json({
    status: true,
    message: "API is running",
  });
});

export default app;