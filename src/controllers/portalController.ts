import { Request, Response, NextFunction } from "express";
import portalService from "../services/portalService";

export const createPortal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { language, isEditable, password, expiresInHours } = req.body;

    const result = await portalService.createPortal({
      language,
      isEditable,
      password,
      expiresInHours,
    });

    res.status(201).json({
      success: true,
      message: "Code Portal created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getPortalMeta = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code } = req.params;
    const portal = await portalService.getPortalMeta(code);

    if (!portal) {
      return res.status(404).json({
        success: false,
        message: "Portal not found or expired",
      });
    }

    res.status(200).json({
      success: true,
      data: portal,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPortal = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { code, password } = req.body;
    const result = await portalService.verifyPortal(code, password);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};
