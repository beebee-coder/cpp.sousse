import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { authAudit } from '@/lib/auth-audit';

const COOKIE_NAME = 'visionode-session';
const SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

// encode secret as Uint8Array
const encodedSecret = new TextEncoder().encode(SECRET);

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface SessionPayload {
  user: SessionUser;
}

export async function createSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  
  const token = await new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(encodedSecret);

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 hours
  });
  
  authAudit.success('SESSION_COOKIE_CREATED', {
    userId: user.id,
    role: user.role,
    name: `${user.firstName} ${user.lastName}`,
    expiresInHours: 8,
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
  authAudit.info('SESSION_COOKIE_CLEARED', {});
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  
  if (!token) {
    authAudit.info('SESSION_NO_COOKIE', {});
    return null;
  }
  
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ['HS256'],
    });
    
    const session = payload as unknown as SessionPayload;
    
    authAudit.info('SESSION_RESTORED', {
      userId: session.user.id,
      role: session.user.role,
      name: `${session.user.firstName} ${session.user.lastName}`,
    });
    
    return session;
  } catch (error) {
    authAudit.warn('SESSION_INVALID_OR_EXPIRED', {
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

// Function to decode JWT from Edge Middleware explicitly without calling `cookies()` api which acts differently in middleware
export async function getSessionFromToken(token: string): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedSecret, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
