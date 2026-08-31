import request from "supertest";
import app from "../src/app.js";
import pool from "../src/db/database.js";

describe("GET /billing/:tenantId", () => {
  test("should return billing summary for an existing tenant", async () => {
    const response = await request(app)
      .get("/billing/8");

    expect(response.statusCode).toBe(200);

    expect(response.body.status).toBe(true);

    expect(response.body.data).toHaveProperty("tenant_id");
    expect(response.body.data).toHaveProperty("subscription");
    expect(response.body.data).toHaveProperty("plan");
    expect(response.body.data).toHaveProperty("usage");
    expect(response.body.data).toHaveProperty("overage");
    expect(response.body.data).toHaveProperty("billing");
  });

  test("should return 404 for a non-existent tenant", async () => {
    const response = await request(app)
      .get("/billing/999999");

    expect(response.statusCode).toBe(404);

    expect(response.body.status).toBe(false);
  });

  test("should reject an invalid tenant ID", async () => {
    const response = await request(app)
      .get("/billing/abc");

    expect(response.statusCode).toBe(400);

    expect(response.body.status).toBe(false);
  });
});

afterAll(async () => {
  await pool.end();
});