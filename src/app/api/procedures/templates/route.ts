export const dynamic = 'force-dynamic';
export const revalidate = false;
import { NextResponse } from 'next/server';

export async function GET() { return NextResponse.json({ message: "Not implemented" }); }
