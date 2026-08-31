import express from "express";
import { validationResult } from "express-validator";
import {
  createSubscription,
  getTenantSubscription,
  changeSubscription
} from "../services/subscription-service.js";
import {
  createSubscriptionValidation,
  getSubscriptionValidation,
  changeSubscriptionValidation
} from "../services/subscription-validation.js";

const router = express.Router();

router.post("/", createSubscriptionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: "Invalid request data",
        errors: errors.array(),
      });
    }

    const {
      tenant_id,
      plan_id,
      status = "active",
    } = req.body;

    const subscription = await createSubscription(
      tenant_id,
      plan_id,
      status
    );

    return res.status(201).json({
      status: true,
      data: subscription,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "23503") {
    return res.status(404).json({
        status: false,
        message: "Tenant or plan not found",
    });
    }

    if (error.code === "23505") {
    return res.status(409).json({
        status: false,
        message: "Tenant already has an active subscription",
    });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to create subscription",
    });
  }
});

router.patch(
  "/:tenantId",
  changeSubscriptionValidation,
  async (req, res) => {
    try {
        const tenantId = Number(req.params.tenantId);
        const { plan_id } = req.body;

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
        return res.status(400).json({
            status: false,
            message: "Invalid request data",
            errors: errors.array(),
        });
        }


      const subscription = await changeSubscription(
        tenantId,
        plan_id
      );

      if (!subscription) {
        return res.status(404).json({
          status: false,
          message: "Active subscription not found",
        });
      }

      return res.status(200).json({
        status: true,
        data: subscription,
      });
    } catch (error) {
      console.error(error);

      if (error.code === "23503") {
        return res.status(404).json({
          status: false,
          message: "Plan not found",
        });
      }

      return res.status(500).json({
        status: false,
        message: "Failed to change subscription",
      });
    }
  }
);

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

      const subscription = await getTenantSubscription(tenantId);

      if (!subscription) {
        return res.status(404).json({
          status: false,
          message: "Active subscription not found",
        });
      }

      return res.status(200).json({
        status: true,
        data: subscription,
      });
    } catch (error) {
      console.error(error);

      return res.status(500).json({
        status: false,
        message: "Failed to get subscription",
      });
    }
  }
);

export default router;