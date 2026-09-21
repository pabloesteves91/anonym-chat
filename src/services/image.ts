/**
 * Bildaufbereitung für die manuelle Prüfung.
 *
 * Aus dem gewählten Foto wird eine verkleinerte Vorschau erzeugt, die der
 * Prüfung reicht und wenig Platz braucht. Das Original verlässt das Gerät
 * nicht und wird nirgends abgelegt – weiterverarbeitet wird nur die Vorschau,
 * und auch die nur im Sitzungsspeicher.
 */

const MAX_KANTE = 720
const QUALITAET = 0.72

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024

export interface Preview {
  /** Verkleinertes Bild als data:-URL. */
  dataUrl: string
  meta: { name: string; size: number; type: string }
}

export class ImageError extends Error {}

function ladeBild(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageError('Das Bild konnte nicht gelesen werden.'))
    }
    img.src = url
  })
}

export async function createPreview(file: File): Promise<Preview> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Bitte ein Foto auswählen (JPEG, PNG oder HEIC als JPEG exportiert).')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError('Das Foto ist zu gross. Bitte eines unter 12 MB wählen.')
  }

  const img = await ladeBild(file)
  const faktor = Math.min(1, MAX_KANTE / Math.max(img.width, img.height))
  const breite = Math.max(1, Math.round(img.width * faktor))
  const hoehe = Math.max(1, Math.round(img.height * faktor))

  const canvas = document.createElement('canvas')
  canvas.width = breite
  canvas.height = hoehe
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('Das Bild konnte nicht verarbeitet werden.')
  ctx.drawImage(img, 0, 0, breite, hoehe)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', QUALITAET),
    meta: { name: file.name, size: file.size, type: file.type },
  }
}
