import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { authAudit } from '@/lib/auth-audit';

const COOKIE_NAME = 'visionode-session';

/**
 * Le secret est résolu à la demande (et non plus au chargement du module) afin
 * d'éviter qu'un `throw` au niveau racine ne fasse échouer le build Next.js
 * (phase « Collecting page data ») quand AUTH_SECRET n'est pas encore défini
 * (CI, preview, build hors-ligne). La validation survient uniquement lors de
 * l'appel réel à une fonction de signature/vérification.
 */
function getEncodedSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET environment variable is required');
  }
  return new TextEncoder().encode(secret);
}

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
    .sign(getEncodedSecret());

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

/**
 * Émet un JWT signé (HS256) de courte durée (5 min) destiné au transfert de
 * session web → application desktop (Tauri) via deep link `visionode://auth`.
 * Contrairement au cookie de session, ce jeton embarque l'e-mail et porte une
 * audience/émetteur explicites afin que le backend cloud puisse le vérifier
 * de façon autonome (l'app desktop n'a pas accès au secret).
 */
export async function createDesktopHandoffToken(
  user: SessionUser & { email?: string }
): Promise<string> {
  return new SignJWT({ user: { id: user.id, email: user.email ?? '', firstName: user.firstName, lastName: user.lastName, role: user.role } })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .setIssuer('visionode-web')
    .setAudience('visionode-desktop')
    .sign(getEncodedSecret());
}

export async function getSessionFromCookie(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    authAudit.info('SESSION_NO_COOKIE', {});
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getEncodedSecret(), {
      algorithms: ['HS256'],
    });

    const session = payload as unknown as SessionPayload;

    if (!session?.user?.id) {
      authAudit.warn('SESSION_INVALID_PAYLOAD', { payload });
      return null;
    }

    authAudit.info('SESSION_RESTORED', {
      userId: session.user.id,
      role: session.user.role,
      name: `${session.user.firstName ?? ''} ${session.user.lastName ?? ''}`.trim() || session.user.id,
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
    const { payload } = await jwtVerify(token, getEncodedSecret(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
