import pool from "../db/database.js";

export async function recordUsage(
  tenantId,
  type,
  quantity,
  idempotencyKey,
  metadata = null
) {
  const result = await pool.query(
    `INSERT INTO usage_events
      (tenant_id, type, quantity, idempotency_key, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (tenant_id, idempotency_key)
     DO NOTHING
     RETURNING *`,
    [tenantId, type, quantity, idempotencyKey, metadata]
  );

  if (result.rows.length === 0) {
    return {
      duplicate: true,
    };
  }

  return {
    duplicate: false,
    usage: result.rows[0],
  };
}
