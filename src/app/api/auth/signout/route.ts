import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/auth';

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
