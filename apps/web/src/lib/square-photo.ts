/**
 * A picked photo as a small square JPEG data URL (centre-cropped, 256px), so
 * a phone's 5 MB picture becomes ~20 KB. Fits the profile schema's limit and
 * is what the mock stores; the real backend will upload it to storage instead.
 */
export async function squarePhoto(file: File, size = 256): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('canvas unavailable');
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
