import pool from "../db/database.js";

export async function recordUsage(
  tenantId,
  type,
  quantity,
  idempotencyKey,
  metadata = null
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get the tenant's active subscription and lock it.
    const subscriptionResult = await client.query(
      `SELECT
         subscriptions.id,
         subscriptions.tenant_id,
         subscriptions.plan_id,
         subscriptions.status,
         plans.name AS plan_name,
         plans.api_call_quota,
         plans.ai_token_quota
       FROM subscriptions
       JOIN plans
         ON subscriptions.plan_id = plans.id
       WHERE subscriptions.tenant_id = $1
         AND subscriptions.status = 'active'
       LIMIT 1
       FOR UPDATE OF subscriptions`,
      [tenantId]
    );

    if (subscriptionResult.rows.length === 0) {
      const error = new Error("No active subscription");
      error.code = "NO_ACTIVE_SUBSCRIPTION";
      throw error;
    }

    const subscription = subscriptionResult.rows[0];

    // Determine the quota based on the usage type.
    let quota;

    if (type === "api_call") {
      quota = subscription.api_call_quota;
    } else if (type === "ai_tokens") {
      quota = subscription.ai_token_quota;
    } else {
      const error = new Error("Unsupported usage type");
      error.code = "UNSUPPORTED_USAGE_TYPE";
      throw error;
    }

    // Calculate the tenant's current usage.
    const usageResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total
       FROM usage_events
       WHERE tenant_id = $1
         AND type = $2`,
      [tenantId, type]
    );

    const currentUsage = Number(usageResult.rows[0].total);

    // Check whether the requested usage would exceed the quota.
    if (currentUsage + quantity > quota) {
      const error = new Error("Usage quota exceeded");

      error.code = "QUOTA_EXCEEDED";
      error.currentUsage = currentUsage;
      error.quota = quota;
      error.remaining = Math.max(quota - currentUsage, 0);
      error.requested = quantity;

      throw error;
    }

    // Record the usage event.
    const insertResult = await client.query(
      `INSERT INTO usage_events
        (tenant_id, type, quantity, idempotency_key, metadata)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, idempotency_key)
       DO NOTHING
       RETURNING *`,
      [
        tenantId,
        type,
        quantity,
        idempotencyKey,
        metadata,
      ]
    );

    // The request has already been recorded.
    if (insertResult.rows.length === 0) {
      await client.query("COMMIT");

      return {
        duplicate: true,
      };
    }

    await client.query("COMMIT");

    return {
      duplicate: false,
      usage: insertResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}

export async function getUsage(tenantId, type) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(quantity), 0) AS total
     FROM usage_events
     WHERE tenant_id = $1
       AND type = $2`,
    [tenantId, type]
  );

  return Number(result.rows[0].total);
}