export const MAX_DIM = 256;

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });
}

export function resizeDataUrl(dataUrl: string, type = 'image/jpeg'): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('CANVAS_UNAVAILABLE'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL(type, 0.85));
    };
    img.onerror = () => reject(new Error('IMAGE_LOAD_ERROR'));
    img.src = dataUrl;
  });
}
