import pool from "../db/database.js";

export async function createSubscription(tenantId, planId, status) {
  const result = await pool.query(
    `INSERT INTO subscriptions
      (tenant_id, plan_id, status)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [tenantId, planId, status]
  );

  return result.rows[0];
}

export async function getTenantSubscription(tenantId) {
  const result = await pool.query(
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
     LIMIT 1`,
    [tenantId]
  );

  return result.rows[0] ?? null;
}