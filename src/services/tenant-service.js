import pool from "../db/database.js";

export async function createTenant(name, email) {
  const result = await pool.query(
    `INSERT INTO tenants (name, email)
     VALUES ($1, $2)
     RETURNING *`,
    [name, email]
  );

  return result.rows[0];
}