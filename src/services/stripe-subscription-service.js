import stripe from "../config/stripe.js";
import pool from "../db/database.js";

export async function createStripeSubscription(tenantId) {
  if (!stripe) {
    const error = new Error("Stripe is not configured");
    error.code = "STRIPE_NOT_CONFIGURED";
    throw error;
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;

  if (!priceId) {
    const error = new Error("Stripe Pro price is not configured");
    error.code = "STRIPE_PRICE_NOT_CONFIGURED";
    throw error;
  }

  // Get the tenant and subscription.
  const result = await pool.query(
    `SELECT
       subscriptions.id AS subscription_id,
       subscriptions.tenant_id,
       subscriptions.stripe_customer_id,
       subscriptions.stripe_subscription_id,
       subscriptions.status,
       plans.id AS plan_id,
       plans.name AS plan_name
     FROM subscriptions
     JOIN plans
       ON subscriptions.plan_id = plans.id
     WHERE subscriptions.tenant_id = $1
     LIMIT 1`,
    [tenantId]
  );

  if (result.rows.length === 0) {
    const error = new Error("Tenant has no subscription");
    error.code = "NO_SUBSCRIPTION";
    throw error;
  }

  const subscription = result.rows[0];

  if (!subscription.stripe_customer_id) {
    const error = new Error("Stripe customer has not been created");
    error.code = "NO_STRIPE_CUSTOMER";
    throw error;
  }

  if (subscription.stripe_subscription_id) {
    return {
      duplicate: true,
      subscription_id: subscription.stripe_subscription_id,
    };
  }

  // Create the subscription in Stripe.
  const stripeSubscription = await stripe.subscriptions.create({
    customer: subscription.stripe_customer_id,
    items: [
      {
        price: priceId,
      },
    ],
  });

  // Save the Stripe subscription ID locally.
  await pool.query(
    `UPDATE subscriptions
     SET stripe_subscription_id = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [
      stripeSubscription.id,
      subscription.subscription_id,
    ]
  );

  return {
    duplicate: false,
    subscription_id: stripeSubscription.id,
    status: stripeSubscription.status,
  };
}