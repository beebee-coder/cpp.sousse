import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = false;

export async function POST() {
  try {
    const scriptPath = path.resolve(process.cwd(), 'update-dev.ps1');
    const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`;

    // Execute the process asynchronously, don't await its completion to avoid Vercel/Next.js timeouts
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [UPDATE] Erreur d'exécution: ${error.message}`);
        return;
      }
      if (stderr) {
        console.warn(`⚠️ [UPDATE] Avertissements: ${stderr}`);
      }
      console.log(`✅ [UPDATE] Processus terminé:\n${stdout}`);
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Mise à jour lancée en arrière-plan.' 
    });

  } catch (error: any) {
    console.error('❌ [UPDATE] Erreur inattendue:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
