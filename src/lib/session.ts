import { cookies } from 'next/headers';
import { createHmac } from 'crypto';

const COOKIE_NAME = 'visionode-session';
const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface SessionPayload {
  user: SessionUser;
  exp: number;
}

function sign(payload: string) {
  return createHmac('sha256', SECRET).update(payload).digest('hex');
}

function serialize(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(body);
  return `${body}.${signature}`;
}

function deserialize(token: string): SessionPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (sign(body) !== signature) return null;
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded) as SessionPayload;
    if (parsed.exp <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function createSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  const payload: SessionPayload = {
    user,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
  };
  cookieStore.set(COOKIE_NAME, serialize(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return deserialize(token);
}
