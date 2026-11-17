import { Injectable } from '@angular/core';
import { Evidence } from '../core/domain/models';
import { EvidenceReader } from '../core/domain/ports';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Validate and decode images before persistence. GIF/WebP become PNG for reliable PDF embedding. */
export async function readEvidence(file: File): Promise<Evidence> {
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
    throw new Error('Usa una imagen PNG, JPG, WebP o GIF.');
  }
  if (file.size > MAX_IMAGE_BYTES) throw new Error(`La imagen «${file.name}» supera el límite de 5 MB.`);
  if (!file.size) throw new Error(`La imagen «${file.name}» está vacía.`);

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`No se pudo leer «${file.name}».`));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`«${file.name}» no es una imagen válida.`));
    element.src = dataUrl;
  });
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
    throw new Error(`La imagen «${file.name}» tiene dimensiones demasiado grandes.`);
  }
  if (file.type === 'image/jpeg' || file.type === 'image/png') {
    return { name: file.name || 'captura', mimeType: file.type, dataUrl };
  }
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen en este navegador.');
  context.drawImage(image, 0, 0);
  const png = canvas.toDataURL('image/png');
  if (png.length > 8 * 1024 * 1024) throw new Error(`La imagen «${file.name}» es demasiado grande al procesarla.`);
  return { name: file.name || 'captura.png', mimeType: 'image/png', dataUrl: png };
}

@Injectable({ providedIn: 'root' })
export class BrowserEvidenceReader implements EvidenceReader {
  read(file: File): Promise<Evidence> { return readEvidence(file); }
}
