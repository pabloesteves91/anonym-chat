import { getAuth } from 'firebase-admin/auth'
import { defineSecret } from 'firebase-functions/params'
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { GRUENDE, REGION, THEMEN, senden, type Einbettung } from './discord.js'

/**
 * Das Protokoll der Moderation im Discord-Kanal für Logs.
 *
 * Festgehalten wird, wer was entschieden hat: Supportfälle übernommen und
 * erledigt, Meldungen geprüft oder mit Sperre abgeschlossen, Tarife vergeben,
 * Geschlechtsangaben korrigiert.
 *
 * Wer es war, steht im Dokument selbst (`bearbeitetVon`, `geaendertVon`) –
 * die App schreibt die eigene Kennung mit, und die Security Rules lassen nur
 * diese zu. Ein Auslöser sieht sonst nur die Änderung, nicht die Person.
 *
 * Was nach Discord geht, ist abgesprochen:
 *   - die Moderatorin oder der Moderator mit der E-Mail des Kontos
 *     (Personaldaten, privater Server)
 *   - die betroffene Person nur als Kurzkennung, „Konto a1b2c3" – die ersten
 *     sechs Zeichen der Kontokennung, in der Moderation auffindbar, für
 *     Dritte ohne Aussage. Kein Pseudonym, kein Text, keine Mail.
 *   - Geschlechtsangaben nur, wenn die Moderation sie korrigiert; die eigene
 *     Erstangabe einer Person erscheint nicht.
 */

const DISCORD_WEBHOOK_LOG = defineSecret('DISCORD_WEBHOOK_LOG')

const FARBE_UEBERNOMMEN = 0xd9a441
const FARBE_ERLEDIGT = 0x4ec4b0
const FARBE_SPERRE = 0x9e4130
const FARBE_NEUTRAL = 0x596a65

const TARIFE: Record<string, string> = {
  frei: 'Gratis',
  'plus-monat': 'Plus (Monat)',
  'plus-jahr': 'Plus (Jahr)',
  lifetime: 'Lifetime',
}

const GESCHLECHT: Record<string, string> = { weiblich: 'weiblich', maennlich: 'männlich' }

export const kurzkennung = (uid: unknown) => `Konto ${String(uid ?? '').slice(0, 6) || '?'}`

/** Die Person hinter einer Kennung, so wie sie im Protokoll stehen soll. */
export async function wer(kennung: unknown): Promise<string> {
  if (kennung === 'kasse') return 'Kasse (Stripe)'
  if (typeof kennung !== 'string' || !kennung) return 'unbekannt'
  try {
    const konto = await getAuth().getUser(kennung)
    return konto.email ?? kurzkennung(kennung)
  } catch {
    return kurzkennung(kennung)
  }
}

const datum = (iso: unknown) =>
  typeof iso === 'string'
    ? new Date(iso).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Zurich' })
    : 'unbefristet'

type Daten = Record<string, unknown>

/** Ein Protokolleintrag, noch ohne die Person, die es war. */
type Eintrag = Omit<Einbettung, 'fields'> & { felder: [string, string][] }

/* ------------------------------------------------ was protokolliert wird */
// Reine Funktionen: Vorher und nachher rein, ein Eintrag (oder keiner) raus.
// Die Person hinter der Kennung wird erst beim Senden nachgeschlagen.

export function supportEintrag(vor: Daten, nach: Daten): Eintrag | null {
  if (vor.status === nach.status) return null
  const titel =
    nach.status === 'inArbeit'
      ? '🟡 Supportfall übernommen'
      : nach.status === 'erledigt'
        ? '✅ Supportfall erledigt'
        : '↩️ Supportfall wieder offen'
  const farbe = nach.status === 'inArbeit' ? FARBE_UEBERNOMMEN : nach.status === 'erledigt' ? FARBE_ERLEDIGT : FARBE_NEUTRAL
  return {
    title: titel,
    color: farbe,
    felder: [
      ['Fall von', kurzkennung(nach.userId)],
      ['Thema', THEMEN[String(nach.thema)] ?? 'Unbekannt'],
    ],
  }
}

export function meldungEintrag(vor: Daten, nach: Daten): Eintrag | null {
  if (vor.status === nach.status) return null
  const titel =
    nach.status === 'gesperrt'
      ? '⛔ Meldung: Konto gesperrt'
      : nach.status === 'geprueft'
        ? '✅ Meldung geprüft, keine Sperre'
        : '↩️ Meldung wieder offen'
  const farbe = nach.status === 'gesperrt' ? FARBE_SPERRE : nach.status === 'geprueft' ? FARBE_ERLEDIGT : FARBE_NEUTRAL
  return {
    title: titel,
    color: farbe,
    felder: [
      ['Gemeldet', kurzkennung(nach.reportedId)],
      ['Grund', GRUENDE[String(nach.reason)] ?? 'Unbekannt'],
    ],
  }
}

export function kontoEintraege(uid: string, vor: Daten, nach: Daten): Eintrag[] {
  const eintraege: Eintrag[] = []

  const tarifVor = vor.membership as Daten | undefined
  const tarifNach = nach.membership as Daten | undefined
  if (tarifNach && JSON.stringify(tarifVor ?? null) !== JSON.stringify(tarifNach)) {
    const plan = String(tarifNach.plan)
    eintraege.push({
      title: plan === 'frei' ? '💳 Tarif zurück auf Gratis' : '💳 Tarif vergeben',
      color: FARBE_ERLEDIGT,
      felder: [
        ['Konto', kurzkennung(uid)],
        ['Tarif', `${TARIFE[String(tarifVor?.plan)] ?? '–'} → ${TARIFE[plan] ?? plan}`],
        ['Gültig bis', plan === 'frei' ? '–' : datum(tarifNach.bis)],
      ],
    })
  }

  // Nur Korrekturen: Die Erstangabe (vorher leer) setzt die Person selbst.
  if (vor.geschlecht && nach.geschlecht && vor.geschlecht !== nach.geschlecht) {
    eintraege.push({
      title: '⚧ Geschlechtsangabe korrigiert',
      color: FARBE_NEUTRAL,
      felder: [
        ['Konto', kurzkennung(uid)],
        ['Angabe', `${GESCHLECHT[String(vor.geschlecht)] ?? '?'} → ${GESCHLECHT[String(nach.geschlecht)] ?? '?'}`],
      ],
    })
  }
  return eintraege
}

async function protokollieren(
  eintrag: Eintrag,
  von: unknown,
): Promise<void> {
  const { felder, ...rest } = eintrag
  await senden(DISCORD_WEBHOOK_LOG.value(), {
    ...rest,
    fields: [...felder, ['Von', await wer(von)] as [string, string]].map(([name, value]) => ({ name, value, inline: true })),
  })
}

/* ------------------------------------------------------------ Auslöser */

export const supportfallProtokoll = onDocumentUpdated(
  { document: 'support/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_LOG] },
  async (event) => {
    const vor = event.data?.before.data()
    const nach = event.data?.after.data()
    if (!vor || !nach) return
    const eintrag = supportEintrag(vor, nach)
    if (eintrag) await protokollieren(eintrag, nach.bearbeitetVon)
  },
)

export const meldungProtokoll = onDocumentUpdated(
  { document: 'reports/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_LOG] },
  async (event) => {
    const vor = event.data?.before.data()
    const nach = event.data?.after.data()
    if (!vor || !nach) return
    const eintrag = meldungEintrag(vor, nach)
    if (eintrag) await protokollieren(eintrag, nach.bearbeitetVon)
  },
)

export const kontoProtokoll = onDocumentUpdated(
  { document: 'users/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_LOG] },
  async (event) => {
    const vor = event.data?.before.data()
    const nach = event.data?.after.data()
    if (!vor || !nach) return
    for (const eintrag of kontoEintraege(event.params.id, vor, nach)) {
      await protokollieren(eintrag, nach.geaendertVon)
    }
  },
)

/* ------------------------------------------------------------ Aktionen */

export function aktionEintrag(vor: Daten | undefined, nach: Daten | undefined): Eintrag | null {
  const aktion = nach ?? vor
  if (!aktion) return null
  const name = `„${String(aktion.name ?? 'ohne Namen')}"${aktion.code ? ` (Code ${String(aktion.code)})` : ''}`
  if (!nach) return { title: `🗑️ Aktion ${name} gelöscht`, color: FARBE_NEUTRAL, felder: [] }
  const teile: [string, string][] = [
    ['Stand', nach.aktiv ? 'eingeschaltet' : 'ausgeschaltet'],
    ['Start', typeof nach.start === 'string' ? datum(nach.start) : '–'],
  ]
  if (Number(nach.gratisTage) > 0) teile.push(['Gratis', `${String(nach.gratisTage)} Tage`])
  if (Number(nach.rabattProzent) > 0) {
    teile.push(['Rabatt', `${String(nach.rabattProzent)} % für ${String(nach.rabattTage)} Tage`])
  }
  return {
    title: vor ? `🎉 Aktion ${name} geändert` : `🎉 Aktion ${name} angelegt`,
    color: FARBE_UEBERNOMMEN,
    felder: teile,
  }
}

export const aktionProtokoll = onDocumentWritten(
  { document: 'aktionen/{id}', region: REGION, secrets: [DISCORD_WEBHOOK_LOG] },
  async (event) => {
    const vor = event.data?.before.data()
    const nach = event.data?.after.data()
    const eintrag = aktionEintrag(vor, nach)
    // Beim Löschen steht nicht im Dokument, wer gelöscht hat – die letzte
    // Änderung stammt womöglich von jemand anderem. Also ehrlich: unbekannt.
    if (eintrag) await protokollieren(eintrag, nach?.geaendertVon)
  },
)
