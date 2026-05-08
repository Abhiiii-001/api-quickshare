import Joi from "joi";

export const uploadFileSchema = Joi.object({
  expiry: Joi.optional(),
  downloads: Joi.number().integer().min(1).max(100).required(),
  usePassword: Joi.boolean().required(),
  password: Joi.string().min(6).when("usePassword", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});

export const downloadFileSchema = Joi.object({
  code: Joi.string().length(6).required(),
  password: Joi.string().optional(),
});

export const getUploadUrlSchema = Joi.object({
  fileName: Joi.string().required(),
  fileType: Joi.string().required(),
  fileSize: Joi.number().integer().min(1).max(104857600).required(), // 100MB max
});

export const confirmUploadSchema = Joi.object({
  cloudinaryUrl: Joi.string().uri().required(),
  originalName: Joi.string().required(),
  mimetype: Joi.string().required(),
  size: Joi.number().integer().required(),
  expiry: Joi.string().required(),
  downloads: Joi.number().integer().min(1).max(100).required(),
  usePassword: Joi.boolean().required(),
  resourceType: Joi.string().optional(),
  tempPublicId: Joi.string().optional(),
  password: Joi.string().min(6).when("usePassword", {
    is: true,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
});
