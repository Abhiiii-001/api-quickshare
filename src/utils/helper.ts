import bcrypt from "bcrypt";

export const generateCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string,
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export const calculateExpiryDate = (expiry: string): Date => {
  const now = new Date();
  switch (expiry) {
    case "1":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "2":
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case "3":
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
};

export const sanitizeFileName = (name: string, keepExtension: boolean = false) => {
  if (keepExtension) {
    return name
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9._\-]/g, "");
  }
  return name
    .replace(/\.[^/.]+$/, "")    // remove extension
    .replace(/\s+/g, "_")        // spaces → _
    .replace(/[^a-zA-Z0-9_\-]/g, ""); // strip all special chars
};
