import type { JwtSessionPayload } from '../auth/jwt-session.payload';

declare global {
  namespace Express {
    interface Request {
      sessionUser?: JwtSessionPayload;
    }
  }
}

export {};
