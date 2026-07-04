import { getSessionFromCookie, createSessionCookie, clearSessionCookie } from '@/lib/session';

export { clearSessionCookie } from '@/lib/session';

export async function auth() {
  return getSessionFromCookie();
}

export async function signIn(user: { id: string; firstName: string; lastName: string; role: string }) {
  await createSessionCookie(user);
}

export async function signOut() {
  await clearSessionCookie();
}
