
import { NextResponse } from 'next/server';
import { postgresClient } from '@/lib/db/postgres-client';

/**
 * API Route pour la gestion du dataset (RAG).
 * Sert de tampon pour les captures vocales et les nouveaux documents avant synchronisation.
 */
export async function GET() {
  try {
    const dataset = await postgresClient.getCloudData('project-001');
    
    return NextResponse.json({
      success: true,
      data: dataset,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DATASET_API] Error fetching dataset:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch dataset',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const timestamp = new Date().toISOString();
    
    await postgresClient.upsertCloudData([
      {
        id: `audit-${Date.now()}`,
        projectId: 'project-001',
        type: 'document',
        content: JSON.stringify({ ...body, source: 'voice_input' }),
        tags: ['voice_audit'],
        createdAt: new Date()
      }
    ]);
    
    console.log(`📡 [DATASET_API] [${timestamp}] Item enregistré dans le tampon cloud.`);
    
    return NextResponse.json({
      success: true,
      message: 'Donnée enregistrée avec succès.'
    });
  } catch (error) {
    console.error('[DATASET_API] Error adding to dataset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add to dataset' },
      { status: 500 }
    );
  }
}
