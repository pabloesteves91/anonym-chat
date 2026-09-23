/**
 * Supportanfragen: Themen und Prüfung.
 *
 * Bewusst ein eigenes Modul statt Logik in der Komponente: Hier lässt sich
 * ohne Browser und ohne Firebase prüfen, was das Formular annimmt und was
 * nicht.
 */

export type SupportThema =
  | 'geschlecht'
  | 'anzeigename'
  | 'konto-loeschen'
  | 'tarif'
  | 'gesperrt'
  | 'sonstiges'

/**
 * Die Auswahlliste.
 *
 * Jedes Thema ausser dem letzten entspricht einem Weg, der heute im Dienst
 * ins Leere führt – die Geschlechtsangabe lässt sich nur „über den Support"
 * ändern, die Kontolöschung „veranlassen Sie über" eine Adresse, und so
 * weiter. Wer hier einen Punkt streicht, schliesst die Tür wieder.
 */
export const SUPPORT_THEMEN: { value: SupportThema; label: string; hint: string }[] = [
  {
    value: 'geschlecht',
    label: 'Geschlechtsangabe korrigieren',
    hint: 'Einmal gesetzt, danach nur über uns – dein Anzeigename hängt daran.',
  },
  {
    value: 'anzeigename',
    label: 'Anzeigename',
    hint: 'Name gesperrt, unpassend gewürfelt oder Wunsch nach einem neuen.',
  },
  {
    value: 'konto-loeschen',
    label: 'Konto löschen',
    hint: 'Profil und Mitgliedschaft verschwinden. Wir führen es von Hand aus.',
  },
  {
    value: 'tarif',
    label: 'Tarif und Zahlung',
    hint: 'Freischaltung, Kündigung, Rückerstattung, Fragen zur Rechnung.',
  },
  {
    value: 'gesperrt',
    label: 'Mein Konto ist gesperrt',
    hint: 'Du hältst die Sperre für einen Irrtum und möchtest sie prüfen lassen.',
  },
  {
    value: 'sonstiges',
    label: 'Etwas anderes',
    hint: 'Passt in keinen der Punkte darüber.',
  },
]

export const BETREFF_MAX = 80
export const TEXT_MIN = 20
export const TEXT_MAX = 2000

/** Wie viele unerledigte Anfragen eine Person gleichzeitig offen haben darf. */
export const OFFEN_MAX = 3

export interface SupportEntwurf {
  thema: SupportThema | ''
  betreff: string
  text: string
}

/**
 * Prüft, was das Formular hergibt.
 *
 * Absichtlich läuft hier **kein** `scanText`. Der Wortfilter wertet
 * E-Mail-Adressen, Telefonnummern und Verweise als Spam – in einer
 * Supportanfrage sind das genau die Angaben, die man braucht („meine alte
 * Adresse war …", „ich komme über https://… nicht weiter"). Ein Filter würde
 * hier ausgerechnet die hilfreichen Anfragen abweisen. Geprüft werden nur
 * Vollständigkeit und Länge; gelesen wird ohnehin von Hand.
 */
export function validateSupportAnfrage(entwurf: SupportEntwurf): { ok: boolean; error?: string } {
  if (!entwurf.thema) return { ok: false, error: 'Bitte wähle aus, worum es geht.' }
  if (!SUPPORT_THEMEN.some((t) => t.value === entwurf.thema)) {
    return { ok: false, error: 'Dieses Thema gibt es nicht.' }
  }

  const betreff = entwurf.betreff.trim()
  if (!betreff) return { ok: false, error: 'Ein Betreff fehlt.' }
  if (betreff.length > BETREFF_MAX) return { ok: false, error: `Betreff: höchstens ${BETREFF_MAX} Zeichen.` }

  const text = entwurf.text.trim()
  if (text.length < TEXT_MIN) {
    return { ok: false, error: `Beschreib es bitte in mindestens ${TEXT_MIN} Zeichen – sonst müssen wir nachfragen.` }
  }
  if (text.length > TEXT_MAX) return { ok: false, error: `Beschreibung: höchstens ${TEXT_MAX} Zeichen.` }

  return { ok: true }
}

/**
 * Die Rückmeldeadresse.
 *
 * Vorbelegt wird die Adresse des Kontos; wer über Apple mit verdeckter
 * Adresse angemeldet ist, kann eine andere eintragen. Leer bleiben darf sie
 * nicht – eine Anfrage ohne Antwortweg ist eine Sackgasse.
 */
export function validateAntwortadresse(wert: string): { ok: boolean; error?: string } {
  const adresse = wert.trim()
  if (!adresse) return { ok: false, error: 'Ohne Adresse können wir nicht antworten.' }
  if (adresse.length > 120) return { ok: false, error: 'Diese Adresse ist zu lang.' }
  // Bewusst grob: Eine strenge Prüfung weist mehr gültige Adressen ab, als sie
  // ungültige fängt. Ob wirklich jemand antwortet, zeigt erst der Versand.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) {
    return { ok: false, error: 'Das sieht nicht nach einer E-Mail-Adresse aus.' }
  }
  return { ok: true }
}

export function themaLabel(thema: SupportThema): string {
  return SUPPORT_THEMEN.find((t) => t.value === thema)?.label ?? thema
}

/**
 * Der Menüpunkt "Support" für die Person selbst.
 *
 * Sichtbar nur, solange es einen Chat gibt, den die Moderation eröffnet hat,
 * zu einer Anfrage, die noch nicht erledigt ist – "offen" im Sinn von
 * unerledigt, also auch "in Arbeit". Sonst wäre der Punkt ausgerechnet dann
 * weg, wenn die Moderation zu schreiben beginnt.
 *
 * Blinken soll er nur bei einer ungelesenen Antwort. Ein Punkt, der dauernd
 * blinkt, wird übersehen wie einer, der nie blinkt.
 */
export function supportMenue(
  anfragen: { status: string; chatOffen?: boolean; ungelesenNutzer?: boolean }[],
): { sichtbar: boolean; ungelesen: boolean } {
  const laufend = anfragen.filter((a) => a.chatOffen === true && a.status !== 'erledigt')
  return {
    sichtbar: laufend.length > 0,
    ungelesen: laufend.some((a) => a.ungelesenNutzer === true),
  }
}
