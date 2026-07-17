import express from "express";
import { validate } from "../middleware/validator";
import {
  createPortalSchema,
  verifyPortalSchema,
} from "../validators/portalValidator";
import * as portalController from "../controllers/portalController";

const router = express.Router();

router.post(
  "/",
  validate(createPortalSchema),
  portalController.createPortal
);

router.post(
  "/verify",
  validate(verifyPortalSchema),
  portalController.verifyPortal
);

router.get("/:code", portalController.getPortalMeta);

export default router;
