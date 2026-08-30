import express from "express";
import { validationResult } from "express-validator";
import { recordUsage } from "../services/usage-service.js";
import { recordUsageValidation } from "../services/usage-validation.js";

const router = express.Router();

router.post("/", recordUsageValidation, async (req, res) => {
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
      type,
      quantity,
      idempotency_key,
      metadata,
    } = req.body;

    const result = await recordUsage(
      tenant_id,
      type,
      quantity,
      idempotency_key,
      metadata ?? null
    );

    if (result.duplicate) {
      return res.status(200).json({
        status: true,
        message: "Usage event already recorded",
        duplicate: true,
      });
    }

    return res.status(201).json({
      status: true,
      duplicate: false,
      data: result.usage,
    });
  } catch (error) {
    console.error(error);

    if (error.code === "NO_ACTIVE_SUBSCRIPTION") {
      return res.status(404).json({
        status: false,
        message: "No active subscription",
      });
    }

    if (error.code === "QUOTA_EXCEEDED") {
      return res.status(403).json({
        status: false,
        message: "Usage quota exceeded",
        usage: error.currentUsage,
        quota: error.quota,
        remaining: error.remaining,
        requested: error.requested,
      });
    }

    if (error.code === "UNSUPPORTED_USAGE_TYPE") {
      return res.status(400).json({
        status: false,
        message: "Unsupported usage type",
      });
    }

    if (error.code === "23503") {
      return res.status(404).json({
        status: false,
        message: "Tenant not found",
      });
    }

    return res.status(500).json({
      status: false,
      message: "Failed to record usage",
    });
  }
});

export default router;