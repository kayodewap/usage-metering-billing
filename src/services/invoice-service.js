import pool from "../db/database.js";

export async function tenantExists(tenantId) {
  const result = await pool.query(
    `SELECT id
     FROM tenants
     WHERE id = $1`,
    [tenantId]
  );

  return result.rows.length > 0;
}

export async function getTenantInvoices(
  tenantId,
  limit = 20,
  offset = 0,
  status = null,
  from = null,
  to = null
) {
  const values = [tenantId];

  let query = `
    SELECT
      id,
      tenant_id,
      subscription_id,
      stripe_invoice_id,
      status,
      amount_due,
      amount_paid,
      currency,
      period_start,
      period_end,
      created_at,
      updated_at
    FROM invoices
    WHERE tenant_id = $1
  `;

  if (status) {
    values.push(status);

    query += ` AND status = $${values.length}`;
  }

  if (from) {
    values.push(from);

    query += ` AND period_end >= $${values.length}`;
  }

  if (to) {
    values.push(to);

    query += ` AND period_start <= $${values.length}`;
  }

  query += ` ORDER BY created_at DESC`;

  values.push(limit);

  query += ` LIMIT $${values.length}`;

  values.push(offset);

  query += ` OFFSET $${values.length}`;

  const result = await pool.query(query, values);

  return result.rows;
}

export async function countTenantInvoices(
  tenantId,
  status = null,
  from = null,
  to = null
) {
  const values = [tenantId];

  let query = `
    SELECT COUNT(*) AS total
    FROM invoices
    WHERE tenant_id = $1
  `;

  if (status) {
    values.push(status);

    query += ` AND status = $${values.length}`;
  }

  if (from) {
    values.push(from);

    query += ` AND period_end >= $${values.length}`;
  }

  if (to) {
    values.push(to);

    query += ` AND period_start <= $${values.length}`;
  }

  const result = await pool.query(query, values);

  return Number(result.rows[0].total);
}

export async function getTenantInvoice(
  tenantId,
  invoiceId
) {
  const result = await pool.query(
    `SELECT
       id,
       tenant_id,
       subscription_id,
       stripe_invoice_id,
       status,
       amount_due,
       amount_paid,
       currency,
       period_start,
       period_end,
       created_at,
       updated_at
     FROM invoices
     WHERE id = $1
       AND tenant_id = $2
     LIMIT 1`,
    [invoiceId, tenantId]
  );

  return result.rows[0] ?? null;
}