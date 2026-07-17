import { prisma } from "../lib/prisma";
import { generateCode, hashPassword, comparePassword } from "../utils/helper";
import logger from "../config/logger";
import { CreatePortalRequest, PortalData } from "../types";
import { randomUUID } from "crypto";

class PortalService {
  async createPortal(data: CreatePortalRequest): Promise<{ code: string; creatorToken: string }> {
    try {
      let code = generateCode();
      let existingPortal = await prisma.codePortal.findUnique({ where: { code } });

      while (existingPortal) {
        code = generateCode();
        existingPortal = await prisma.codePortal.findUnique({ where: { code } });
      }

      const hashedPassword = data.password ? await hashPassword(data.password) : null;
      
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

      const creatorToken = randomUUID();

      const newPortal = await prisma.codePortal.create({
        data: {
          code,
          language: data.language,
          isEditable: data.isEditable,
          password: hashedPassword,
          expiresAt,
          creatorToken,
        },
      });

      logger.info(`Code Portal created: ${code}`);

      return {
        code: newPortal.code,
        creatorToken: newPortal.creatorToken,
      };
    } catch (error) {
      logger.error("Create portal error:", error);
      throw new Error("Failed to create code portal");
    }
  }

  async getPortalMeta(code: string): Promise<PortalData | null> {
    try {
      const portal = await prisma.codePortal.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!portal) {
        return null;
      }

      if (new Date() > portal.expiresAt) {
        await this.deletePortal(portal.id);
        return null;
      }

      return {
        id: portal.id,
        code: portal.code,
        language: portal.language,
        content: portal.password ? "" : portal.content, // Don't return content if password protected
        isEditable: portal.isEditable,
        activeUsers: portal.activeUsers,
        expiresAt: portal.expiresAt,
        hasPassword: !!portal.password,
      };
    } catch (error) {
      logger.error("Get portal meta error:", error);
      throw new Error("Failed to retrieve portal");
    }
  }

  async verifyPortal(code: string, password?: string): Promise<{ success: boolean; data?: PortalData; message?: string }> {
    try {
      const portal = await prisma.codePortal.findUnique({
        where: { code: code.toUpperCase() },
      });

      if (!portal) {
        return { success: false, message: "Portal not found" };
      }

      if (new Date() > portal.expiresAt) {
        await this.deletePortal(portal.id);
        return { success: false, message: "Portal has expired" };
      }

      if (portal.password) {
        if (!password) {
          return { success: false, message: "Password required" };
        }
        const isPasswordValid = await comparePassword(password, portal.password);
        if (!isPasswordValid) {
          return { success: false, message: "Invalid password" };
        }
      }

      return {
        success: true,
        data: {
          id: portal.id,
          code: portal.code,
          language: portal.language,
          content: portal.content, // Full content since authenticated
          isEditable: portal.isEditable,
          activeUsers: portal.activeUsers,
          expiresAt: portal.expiresAt,
          hasPassword: !!portal.password,
        },
      };
    } catch (error) {
      logger.error("Verify portal error:", error);
      throw new Error("Failed to verify portal");
    }
  }
  
  async updatePortalContent(code: string, content: string): Promise<void> {
    try {
      await prisma.codePortal.update({
        where: { code: code.toUpperCase() },
        data: { content },
      });
    } catch (error) {
      logger.error("Update portal content error:", error);
    }
  }

  async updatePortalSettings(code: string, isEditable: boolean, language: string): Promise<void> {
    try {
      await prisma.codePortal.update({
        where: { code: code.toUpperCase() },
        data: { isEditable, language },
      });
    } catch (error) {
      logger.error("Update portal settings error:", error);
    }
  }

  async verifyCreator(code: string, creatorToken: string): Promise<boolean> {
    try {
      const portal = await prisma.codePortal.findUnique({
        where: { code: code.toUpperCase() },
      });
      return portal?.creatorToken === creatorToken;
    } catch (error) {
      return false;
    }
  }

  async deletePortal(id: string): Promise<void> {
    try {
      await prisma.codePortal.delete({ where: { id } });
      logger.info(`Portal deleted (ID: ${id})`);
    } catch (error) {
      logger.error("Delete portal error:", error);
    }
  }

  async cleanupExpiredPortals(): Promise<void> {
    try {
      const expiredPortals = await prisma.codePortal.findMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      for (const portal of expiredPortals) {
        await this.deletePortal(portal.id);
      }

      if (expiredPortals.length > 0) {
        logger.info(`Cleaned up ${expiredPortals.length} expired portals`);
      }
    } catch (error) {
      logger.error("Cleanup portals error:", error);
    }
  }
}

export default new PortalService();
