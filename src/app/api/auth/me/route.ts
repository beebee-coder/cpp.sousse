export const dynamic = 'force-dynamic';
export const revalidate = false;
import { auth } from '@/lib/auth';
import { getUserById, updateCurrentUser, verifyUserPassword } from '@/lib/auth-store';
import { createSessionCookie } from '@/lib/session';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_IMAGE_BYTES = 500 * 1024;

const patchSchema = z.object({
  firstName: z.optional(z.string().max(100).transform(v => v?.trim()).pipe(z.optional(z.string().max(100)))),
  lastName: z.optional(z.string().max(100).transform(v => v?.trim()).pipe(z.optional(z.string().max(100)))),
  email: z.optional(z.string().email().transform(v => v?.toLowerCase().trim())),
  currentPassword: z.optional(z.string()),
  newPassword: z.optional(z.string().min(8)),
  image: z.optional(z.union([z.string(), z.null()])),
}).refine(data => {
  if (data.image && typeof data.image === 'string') {
    if (!data.image.startsWith('data:image/')) return false;
    const comma = data.image.indexOf(',');
    if (comma === -1) return false;
    const mime = data.image.slice(5, comma);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return false;
    if (data.image.length > MAX_IMAGE_BYTES) return false;
  }
  return true;
}, { message: 'Invalid image format or size', path: ['image'] });

function mapError(error: z.ZodError | string): string {
  if (typeof error === 'string') return error;
  const first = error.issues[0];
  if (!first) return 'VALIDATION_ERROR';
  const path = first.path.join('.');
  if (path === 'email') return 'INVALID_EMAIL';
  if (path === 'newPassword') return 'WEAK_PASSWORD';
  if (path === 'image') return 'INVALID_IMAGE';
  if (path === 'firstName' || path === 'lastName') return 'INVALID_NAME';
  return 'VALIDATION_ERROR';
}

export async function GET() {
  const session = await auth();
  let user = null;
  if (session?.user?.id) {
    user = await getUserById(session.user.id);
  }
  return NextResponse.json({ session, user });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: mapError(parsed.error) }, { status: 400 });
    }

    const { firstName, lastName, email, currentPassword, newPassword, image } = parsed.data;

    if (newPassword) {
      const valid = await verifyUserPassword(session.user.id, currentPassword ?? '');
      if (!valid) {
        return NextResponse.json({ success: false, error: 'INVALID_CURRENT_PASSWORD' }, { status: 400 });
      }
    }

    const result = await updateCurrentUser(session.user.id, {
      firstName,
      lastName,
      email,
      password: newPassword || undefined,
      image,
    });

    if (!result.success) {
      const safeError = result.error === 'EMAIL_ALREADY_EXISTS'
        ? 'EMAIL_ALREADY_EXISTS'
        : result.error === 'USER_NOT_FOUND'
          ? 'USER_NOT_FOUND'
          : 'UPDATE_FAILED';
      return NextResponse.json({ success: false, error: safeError }, { status: 400 });
    }

    const updated = result.user;
    if (!updated) {
      return NextResponse.json({ success: false, error: 'UPDATE_FAILED' }, { status: 500 });
    }

    await createSessionCookie({
      id: updated.id,
      firstName: updated.firstName ?? '',
      lastName: updated.lastName ?? '',
      role: updated.role,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch {
    return NextResponse.json({ success: false, error: 'SERVER_ERROR' }, { status: 500 });
  }
}
