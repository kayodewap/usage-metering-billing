import express from "express";
import { validationResult } from "express-validator";
import { getBillingSummary } from "../services/billing-service.js";
import { getSubscriptionValidation } from "../services/subscription-validation.js";

const router = express.Router();

router.get(
  "/:tenantId",
  getSubscriptionValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          status: false,
          message: "Invalid request data",
          errors: errors.array(),
        });
      }

      const tenantId = Number(req.params.tenantId);

      const billing = await getBillingSummary(tenantId);

      return res.status(200).json({
        status: true,
        data: billing,
      });
    } catch (error) {
      console.error(error);

      if (error.code === "NO_ACTIVE_SUBSCRIPTION") {
        return res.status(404).json({
          status: false,
          message: "No active subscription",
        });
      }

      return res.status(500).json({
        status: false,
        message: "Failed to get billing summary",
      });
    }
  }
);

export default router;