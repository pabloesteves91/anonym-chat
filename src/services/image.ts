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

/**
 * Anhänge dürfen grösser bleiben als Ausweisbilder.
 *
 * Für die Ausweisprüfung reichen 720 Pixel – erkannt werden muss ein Gesicht.
 * Ein Bildschirmfoto in einer Supportanfrage wäre bei 720 Pixeln unlesbar,
 * und ein unlesbarer Beleg ist kein Beleg.
 */
export const ANHANG_KANTE = 1600
export const ANHANG_MAX_BYTES = 8 * 1024 * 1024

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

export async function createPreview(
  file: File,
  optionen: { kante?: number; maxBytes?: number } = {},
): Promise<Preview> {
  const kante = optionen.kante ?? MAX_KANTE
  const maxBytes = optionen.maxBytes ?? MAX_UPLOAD_BYTES

  if (!file.type.startsWith('image/')) {
    throw new ImageError('Wähl bitte ein Bild aus: JPEG oder PNG. HEIC vorher als JPEG exportieren.')
  }
  if (file.size > maxBytes) {
    throw new ImageError(`Das Bild ist zu gross. Wähl eines unter ${Math.round(maxBytes / 1024 / 1024)} MB wählen.`)
  }

  const img = await ladeBild(file)
  const faktor = Math.min(1, kante / Math.max(img.width, img.height))
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
