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
       plans.ai_token_quota,
       plans.monthly_price,
       plans.api_call_overage_price,
       plans.ai_token_overage_price
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

export async function changeSubscription(tenantId, planId) {
  const result = await pool.query(
    `UPDATE subscriptions
     SET plan_id = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $2
       AND status = 'active'
     RETURNING *`,
    [planId, tenantId]
  );

  return result.rows[0] ?? null;
}
