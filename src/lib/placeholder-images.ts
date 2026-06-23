/**
 * @fileOverview Utility to provide safe access to placeholder image data.
 * Consolidates image data from the application's library with enhanced error safety.
 */

import data from '@/app/lib/placeholder-images.json';

export type ImagePlaceholder = {
  id: string;
  description: string;
  imageUrl: string;
  imageHint: string;
};

/**
 * Safely extracts placeholder images from the imported JSON data.
 * Provides a fallback to an empty array and prevents crash during build.
 */
function getPlaceholderImages(): ImagePlaceholder[] {
  if (!data || typeof data !== 'object') return [];
  
  try {
    const rawImages = (data as any)?.placeholderImages;
    if (Array.isArray(rawImages)) {
      return rawImages.map(img => ({
        id: String(img.id || 'unknown'),
        description: String(img.description || ''),
        imageUrl: String(img.imageUrl || ''),
        imageHint: String(img.imageHint || '')
      }));
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn("[VisioNode] Échec de l'extraction des assets visuels :", error);
    }
  }
  
  return [];
}

export const PlaceHolderImages: ImagePlaceholder[] = getPlaceholderImages();
