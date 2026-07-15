import { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  role: Role;
  iat?: number;
  exp?: number;
}
