export const PRODUCT_IMAGE_BUCKET = 'product-images' as const;
export const PRODUCT_IMAGE_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const PRODUCT_IMAGE_MAX_INPUT_BYTES = 10 * 1024 * 1024;

export function validateProductImage(file: File): string | null {
  if (!PRODUCT_IMAGE_INPUT_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_INPUT_TYPES)[number])) return 'Choose a JPG, PNG or WebP image.';
  if (file.size > PRODUCT_IMAGE_MAX_INPUT_BYTES) return 'The original image must be 10 MB or smaller.';
  return null;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The selected image could not be read.')); };
    image.src = url;
  });
}

/** Downsizes large uploads without cropping or changing their aspect ratio. */
export async function resizeProductImage(file: File, maxSide = 900): Promise<Blob> {
  const validation = validateProductImage(file);
  if (validation) throw new Error(validation);
  const image = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image resizing is unavailable in this browser.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('The image could not be resized.')), 'image/webp', 0.86));
}

export function productImageStoragePath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const markerIndex = publicUrl.indexOf(marker);
  if (markerIndex < 0) return null;
  return decodeURIComponent(publicUrl.slice(markerIndex + marker.length).split('?')[0]);
}
