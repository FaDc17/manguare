/**
 * Comprime una foto en el propio teléfono antes de guardarla, para no gastar
 * datos ni llenar el almacenamiento. Devuelve un data URL JPEG.
 */
export async function compressImage(
  file: File,
  options: { maxSide?: number; maxChars?: number } = {},
): Promise<string> {
  const maxSide = options.maxSide ?? 1400;
  const maxChars = options.maxChars ?? 650_000;

  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo no es una imagen.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close?.();
    throw new Error('No se pudo procesar la imagen.');
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.72;
  let data = canvas.toDataURL('image/jpeg', quality);
  while (data.length > maxChars && quality > 0.36) {
    quality -= 0.08;
    data = canvas.toDataURL('image/jpeg', quality);
  }

  if (data.length > maxChars * 1.8) {
    throw new Error('La foto es demasiado grande. Intenta con otra.');
  }

  return data;
}
