import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ success: false, message: 'Non authentifié' }, { status: 401 });
    }

    const tokenPayload = {
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      role: session.user.role,
      exp: Date.now() + 1000 * 60 * 5,
    };

    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64');
    
    return NextResponse.json({ success: true, token });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Erreur interne' }, { status: 500 });
  }
}
