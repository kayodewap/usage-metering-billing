import stripe from "../config/stripe.js";
import pool from "../db/database.js";

export async function createStripeCustomer(tenantId) {
  if (!stripe) {
    const error = new Error("Stripe is not configured");
    error.code = "STRIPE_NOT_CONFIGURED";
    throw error;
  }

  // Get the tenant.
  const tenantResult = await pool.query(
    `SELECT id, name, email
     FROM tenants
     WHERE id = $1`,
    [tenantId]
  );

  if (tenantResult.rows.length === 0) {
    const error = new Error("Tenant not found");
    error.code = "TENANT_NOT_FOUND";
    throw error;
  }

  const tenant = tenantResult.rows[0];

  // Check whether the tenant already has a Stripe customer.
  const subscriptionResult = await pool.query(
    `SELECT id, stripe_customer_id
     FROM subscriptions
     WHERE tenant_id = $1
     ORDER BY id
     LIMIT 1`,
    [tenantId]
  );

  if (subscriptionResult.rows.length === 0) {
    const error = new Error("Tenant has no subscription");
    error.code = "NO_SUBSCRIPTION";
    throw error;
  }

  const subscription = subscriptionResult.rows[0];

  if (subscription.stripe_customer_id) {
    return {
      duplicate: true,
      customer_id: subscription.stripe_customer_id,
    };
  }

  // Create the customer in Stripe.
  const customer = await stripe.customers.create({
    name: tenant.name,
    email: tenant.email,
    metadata: {
      tenant_id: String(tenant.id),
    },
  });

  // Save the Stripe customer ID locally.
  await pool.query(
    `UPDATE subscriptions
     SET stripe_customer_id = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [customer.id, subscription.id]
  );

  return {
    duplicate: false,
    customer_id: customer.id,
  };
}