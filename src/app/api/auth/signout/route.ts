export const dynamic = 'force-dynamic';
export const revalidate = false;
import { clearSessionCookie } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
