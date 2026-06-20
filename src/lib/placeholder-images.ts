
/**
 * @fileOverview Utility to provide safe access to placeholder image data.
 * Consolidates image data from the application's library.
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
 * Provides a fallback to an empty array to prevent "Unexpected end of JSON input"
 * or property access errors if the JSON file is malformed.
 */
function getPlaceholderImages(): ImagePlaceholder[] {
  if (!data) return [];
  
  try {
    const rawImages = (data as any)?.placeholderImages;
    if (Array.isArray(rawImages)) {
      return rawImages;
    }
  } catch (error) {
    console.warn("[VisioNode] Failed to parse placeholder images data:", error);
  }
  
  return [];
}

export const PlaceHolderImages: ImagePlaceholder[] = getPlaceholderImages();
