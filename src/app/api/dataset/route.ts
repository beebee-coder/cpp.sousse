// src/app/api/dataset/route.ts
import { NextResponse } from 'next/server';
import { getDataset } from '@/lib/db/sync-engine';

export async function GET() {
  try {
    // Récupération des données du dataset
    const dataset = await getDataset();
    
    return NextResponse.json({
      success: true,
      data: dataset,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DATASET_AUDIT] Error fetching dataset:', error);
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
    // Logique d'ajout au dataset
    const result = await addToDataset(body);
    
    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('[DATASET_AUDIT] Error adding to dataset:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add to dataset' },
      { status: 500 }
    );
  }
}