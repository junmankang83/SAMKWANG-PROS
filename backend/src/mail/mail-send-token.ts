import { randomBytes } from 'node:crypto';

/** URL·DB에 쓰는 열람 추적 토큰(16바이트 hex = 32자). */
export function generateOpenTrackingToken(): string {
  return randomBytes(16).toString('hex');
}

export const OPEN_TRACKING_TOKEN_REGEX = /^[a-f0-9]{32}$/;
