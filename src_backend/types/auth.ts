import { Request } from "express";
import type { JwtPayload } from "../utils/jwt";
export type { JwtPayload };


export type JwtUser = {
  id: string;
  email: string;
  role: string;
  impersonated?: boolean;
  impersonatorId?: string;
  impersonatedUserId?: string;
};

export type AuthedRequest = Request & {
  user: JwtPayload;
};
