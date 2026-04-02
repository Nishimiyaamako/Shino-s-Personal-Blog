import { jwtVerify, SignJWT } from 'jose';
import { ENV } from '../config/env';

const encoder = new TextEncoder();

export interface AdminJwtPayload {
  sub: string;
  username: string;
}

function getSecret(): Uint8Array {
  return encoder.encode(ENV.jwtSecret);
}

export async function signAdminToken(payload: AdminJwtPayload): Promise<string> {
  return new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ENV.jwtExpiresInHours}h`)
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminJwtPayload | null> {
  try {
    const verified = await jwtVerify(token, getSecret());
    const subject = verified.payload.sub;
    const username = verified.payload.username;

    if (!subject || typeof username !== 'string') {
      return null;
    }

    return {
      sub: subject,
      username
    };
  } catch {
    return null;
  }
}

export function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization')?.trim();

  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  return authHeader.slice('bearer '.length).trim() || null;
}
