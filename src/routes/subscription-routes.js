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
import { createStripeCustomer } from "../services/stripe-customer-service.js";
import { createStripeSubscription } from "../services/stripe-subscription-service.js";

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

router.post("/:tenantId/stripe-customer", async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);

    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid tenant ID",
      });
    }

    const result = await createStripeCustomer(tenantId);

    return res.status(result.duplicate ? 200 : 201).json({
      status: true,
      duplicate: result.duplicate,
      data: {
        customer_id: result.customer_id,
      },
    });
  } catch (error) {
    console.error(error);

    if (error.code === "STRIPE_NOT_CONFIGURED") {
      return res.status(503).json({
        status: false,
        message: "Stripe is not configured",
      });
    }

    if (error.code === "TENANT_NOT_FOUND") {
      return res.status(404).json({
        status: false,
        message: "Tenant not found",
      });
    }

    if (error.code === "NO_SUBSCRIPTION") {
      return res.status(404).json({
        status: false,
        message: "Tenant has no subscription",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to create Stripe customer",
    });
  }
});

router.post("/:tenantId/stripe-subscription", async (req, res) => {
  try {
    const tenantId = Number(req.params.tenantId);

    if (!Number.isInteger(tenantId) || tenantId <= 0) {
      return res.status(400).json({
        status: false,
        message: "Invalid tenant ID",
      });
    }

    const result = await createStripeSubscription(tenantId);

    return res.status(result.duplicate ? 200 : 201).json({
      status: true,
      duplicate: result.duplicate,
      data: {
        subscription_id: result.subscription_id,
        status: result.status,
      },
    });
  } catch (error) {
    console.error(error);

    if (error.code === "STRIPE_NOT_CONFIGURED") {
      return res.status(503).json({
        status: false,
        message: "Stripe is not configured",
      });
    }

    if (error.code === "STRIPE_PRICE_NOT_CONFIGURED") {
      return res.status(503).json({
        status: false,
        message: "Stripe Pro price is not configured",
      });
    }

    if (error.code === "NO_SUBSCRIPTION") {
      return res.status(404).json({
        status: false,
        message: "Tenant has no subscription",
      });
    }

    if (error.code === "NO_STRIPE_CUSTOMER") {
      return res.status(400).json({
        status: false,
        message: "Stripe customer has not been created",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to create Stripe subscription",
    });
  }
});

export default router;