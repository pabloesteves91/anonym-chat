import type { Einbettung } from './discord.js'
import { kurzkennung } from './kennung.js'

/**
 * Was in #payments steht – reine Texte, ohne Firebase (siehe zahlungen.ts).
 */

const TARIFE: Record<string, string> = {
  'plus-monat': 'Plus (Monat)',
  'plus-jahr': 'Plus (Jahr)',
  lifetime: 'Lifetime',
}

const FARBE_ZAHLUNG = 0x4ec4b0
const FARBE_ENDE = 0x596a65

const datum = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' })
    : 'unbefristet'

/** „CHF 7.90" aus Rappen und Währung. */
export function betragText(rappen: number | null | undefined, waehrung: string | null | undefined): string {
  if (typeof rappen !== 'number') return '–'
  return `${(waehrung ?? 'chf').toUpperCase()} ${(rappen / 100).toFixed(2)}`
}

export function zahlungEintrag(z: {
  uid: string
  plan: string
  rappen: number | null | undefined
  waehrung: string | null | undefined
  bis: string | null
  test: boolean
}): Einbettung {
  return {
    title: `${z.test ? '🧪 Testzahlung' : '💳 Neue Zahlung'}: ${TARIFE[z.plan] ?? z.plan}`,
    color: FARBE_ZAHLUNG,
    fields: [
      { name: 'Konto', value: kurzkennung(z.uid), inline: true },
      { name: 'Betrag', value: betragText(z.rappen, z.waehrung), inline: true },
      { name: 'Gültig bis', value: datum(z.bis), inline: true },
    ],
  }
}

export function aboEndeEintrag(z: { uid: string; test: boolean; lifetime?: boolean }): Einbettung {
  return {
    title: `${z.test ? '🧪 ' : ''}Abo beendet – ${z.lifetime ? 'Lifetime bleibt' : 'zurück auf Gratis'}`,
    color: FARBE_ENDE,
    fields: [{ name: 'Konto', value: kurzkennung(z.uid), inline: true }],
  }
}

