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