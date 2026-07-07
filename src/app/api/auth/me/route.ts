export const dynamic = 'force-dynamic';
export const revalidate = false;
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  return NextResponse.json({ session });
}
