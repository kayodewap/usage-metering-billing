import request from "supertest";
import app from "../src/app.js";
import pool from "../src/db/database.js";

afterAll(async () => {
  await pool.end();
});

describe("GET /health", () => {
  test("should return API health status", async () => {
    const response = await request(app)
      .get("/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      status: true,
      message: "API is running",
    });
  });
});