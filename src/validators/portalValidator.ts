import Joi from "joi";

export const createPortalSchema = Joi.object({
  language: Joi.string().required(),
  isEditable: Joi.boolean().required(),
  password: Joi.string().min(6).optional().allow(""),
  expiresInHours: Joi.number().integer().min(1).max(168).required(), // Max 1 week
});

export const verifyPortalSchema = Joi.object({
  code: Joi.string().length(6).required(),
  password: Joi.string().optional().allow(""),
});
