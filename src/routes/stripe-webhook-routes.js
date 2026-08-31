import express from "express";
import stripe from "../config/stripe.js";
import { processStripeWebhook } from "../services/stripe-webhook-service.js";

const router = express.Router();

router.post(
  "/",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe) {
      return res.status(503).json({
        status: false,
        message: "Stripe is not configured",
      });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return res.status(503).json({
        status: false,
        message: "Stripe webhook secret is not configured",
      });
    }

    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({
        status: false,
        message: "Missing Stripe signature",
      });
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        webhookSecret
      );
    } catch (error) {
      console.error("Stripe webhook signature verification failed:", error);

      return res.status(400).json({
        status: false,
        message: "Invalid Stripe webhook signature",
      });
    }

    try {
      const result = await processStripeWebhook(event);

      return res.status(200).json({
        status: true,
        duplicate: result.duplicate,
      });
    } catch (error) {
      console.error("Stripe webhook processing failed:", error);

      return res.status(500).json({
        status: false,
        message: "Failed to process Stripe webhook",
      });
    }
  }
);

export default router;