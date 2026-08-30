import express from "express";
import { validationResult } from "express-validator";
import { createTenant } from "../services/tenant-service.js";
import { createTenantValidation } from "../services/tenant-validation.js";

const router = express.Router();

router.post("/", createTenantValidation, async (req, res) => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: "Invalid request data",
        errors: errors.array(),
      });
    }

    const { name, email } = req.body;

    const tenant = await createTenant(name, email);

    res.status(201).json({
      status: true,
      data: tenant,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: false,
      message: "Failed to create tenant",
    });
  }
});

export default router;