import { body, param } from "express-validator";

export const createSubscriptionValidation = [
  body("tenant_id")
    .isInt({ min: 1 })
    .withMessage("tenant_id must be a positive integer"),

  body("plan_id")
    .isInt({ min: 1 })
    .withMessage("plan_id must be a positive integer"),

  body("status")
    .optional()
    .trim()
    .isIn(["active", "canceled"])
    .withMessage("Status must be active or canceled"),
];

export const getSubscriptionValidation = [
  param("tenantId")
    .isInt({ min: 1 })
    .withMessage("tenantId must be a positive integer"),
];

export const changeSubscriptionValidation = [
  param("tenantId")
    .isInt({ min: 1 })
    .withMessage("tenantId must be a positive integer"),

  body("plan_id")
    .isInt({ min: 1 })
    .withMessage("plan_id must be a positive integer"),
];