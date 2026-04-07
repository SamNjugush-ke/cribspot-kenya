// backend/src/types/externals.d.ts
declare module "swagger-jsdoc";
declare module "swagger-ui-express";

declare global {
  namespace Express {
    interface Request {
      user?: import("../utils/jwt").JwtPayload;
    }
  }
}

export {};
