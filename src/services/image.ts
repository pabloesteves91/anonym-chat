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

/**
 * Platzhalterbild für Testdurchläufe.
 *
 * Niemand soll für einen Prototyp-Test ein echtes Ausweisfoto hochladen –
 * dieser Knopf erzeugt stattdessen ein gezeichnetes Bild in derselben Form,
 * das den ganzen Weg bis zur Prüfansicht durchläuft.
 */
export function createDemoPreview(kind: 'ausweis' | 'selfie'): Preview {
  const breite = 640
  const hoehe = 400
  const canvas = document.createElement('canvas')
  canvas.width = breite
  canvas.height = hoehe
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('Das Demo-Bild konnte nicht erzeugt werden.')

  const ausweis = kind === 'ausweis'
  ctx.fillStyle = ausweis ? '#dce8e4' : '#e6e2da'
  ctx.fillRect(0, 0, breite, hoehe)

  ctx.strokeStyle = '#1f6f63'
  ctx.lineWidth = 6
  ctx.strokeRect(20, 20, breite - 40, hoehe - 40)

  // Angedeutetes Passbild beziehungsweise Gesicht.
  ctx.fillStyle = '#b9c3bf'
  if (ausweis) {
    ctx.fillRect(56, 110, 150, 190)
  } else {
    ctx.beginPath()
    ctx.arc(breite / 2, 180, 78, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillRect(breite / 2 - 110, 280, 220, 90)
  }

  ctx.fillStyle = '#141f1c'
  ctx.font = 'bold 34px Georgia, serif'
  ctx.fillText(ausweis ? 'DEMO-AUSWEIS' : 'DEMO-SELFIE', ausweis ? 240 : 150, 80)

  ctx.font = '20px monospace'
  ctx.fillStyle = '#5d6b67'
  if (ausweis) {
    ctx.fillText('Muster, Alex', 240, 150)
    ctx.fillText('geb. 04.06.1991', 240, 185)
    ctx.fillText('gültig bis 2031', 240, 220)
    ctx.fillText('CH-XX-000000', 240, 255)
  } else {
    ctx.fillText('Testbild – kein echtes Foto', 150, 350)
  }

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITAET)
  return {
    dataUrl,
    meta: {
      name: ausweis ? 'demo-ausweis.jpg' : 'demo-selfie.jpg',
      size: Math.round((dataUrl.length * 3) / 4),
      type: 'image/jpeg',
    },
  }
}
