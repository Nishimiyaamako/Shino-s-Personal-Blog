import { getBearerToken, verifyAdminToken } from '../auth/jwt';

export interface RouteErrorPayload {
  error: string;
}

export function asPositiveInt(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    throw new Error('请求体必须是 application/json');
  }

  return (await request.json()) as T;
}

export async function requireAdmin(
  request: Request,
  set: { status?: number | string }
): Promise<{ id: number; username: string } | null> {
  const token = getBearerToken(request);

  if (!token) {
    set.status = 401;
    return null;
  }

  const payload = await verifyAdminToken(token);

  if (!payload) {
    set.status = 401;
    return null;
  }

  const id = Number.parseInt(payload.sub, 10);

  if (!Number.isInteger(id) || id <= 0) {
    set.status = 401;
    return null;
  }

  return {
    id,
    username: payload.username
  };
}

const SAFE_URL_REGEXP = /^https?:\/\/.+/i;

export function validateUrl(value: string, label: string): void {
  if (!value) {
    return;
  }
  if (!SAFE_URL_REGEXP.test(value.trim())) {
    throw new Error(`${label} 格式不正确，必须以 http:// 或 https:// 开头`);
  }
}

export function toErrorPayload(error: unknown): RouteErrorPayload {
  if (error instanceof Error) {
    return { error: error.message };
  }

  return { error: 'Unknown error' };
}
