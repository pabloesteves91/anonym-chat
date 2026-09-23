import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'

/**
 * Die Security Rules gegen den Emulator.
 *
 * Diese Datei prüft nicht, ob die App funktioniert, sondern ob sie sich
 * nicht umgehen lässt: Kann ein nicht verifiziertes Konto in die
 * Warteschlange? Liest jemand fremde Chats? Setzt sich ein Konto selbst auf
 * Lifetime? Was hier durchfällt, fällt im Betrieb niemandem auf – bis es
 * jemand ausnutzt.
 *
 * Start: npm run test:rules (braucht den Firestore-Emulator).
 */

const MODERATOR = 'RwwpyDrsJldCIx38BcBHVsgTXc32'
/**
 * Eine reine Moderationskennung.
 *
 * Die Liste in den Regeln ist im Auslieferungszustand leer und enthält nur
 * einen Platzhalter. Damit sich die Rollentrennung trotzdem prüfen lässt,
 * wird er hier durch diese Kennung ersetzt – geprüft wird die Regel, nicht
 * ihr Inhalt.
 */
const NUR_MOD = 'konto-nur-moderation'
const PLATZHALTER = "'PLATZHALTER_KEINE_WEITEREN_MODERATOREN'"
const ANNA = 'konto-anna'
const BEN = 'konto-ben'
const FREMD = 'konto-fremd'

let env: RulesTestEnvironment

const konto = (patch: Record<string, unknown> = {}) => ({
  pseudonym: 'Blauer Falke 4417',
  verificationStatus: 'verifiziert',
  verifiedAt: null,
  phone: null,
  profile: { language: 'de', ageGroup: '25–34', interests: [] },
  membership: { plan: 'frei', seit: '2026-01-01T00:00:00.000Z', bis: null },
  usage: { tag: '2026-01-01', chats: 0 },
  planChosen: false,
  codexAccepted: false,
  selfBlocked: [],
  ...patch,
})

const warteEintrag = (uid: string, patch: Record<string, unknown> = {}) => ({
  uid,
  pseudonym: 'Wartend',
  language: 'de',
  interests: [],
  wantsInterests: [],
  bevorzugt: false,
  since: Timestamp.now(),
  roomId: null,
  ...patch,
})

const raum = (patch: Record<string, unknown> = {}) => ({
  id: 'raum-1',
  participants: [ANNA, BEN],
  pseudonyms: { [ANNA]: 'Anna', [BEN]: 'Ben' },
  startedAt: Timestamp.now(),
  endedAt: null,
  expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000),
  reported: false,
  flagCount: 0,
  messageCount: 0,
  typing: {},
  seen: {},
  left: [],
  ...patch,
})

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-anonym-chat',
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8').replace(PLATZHALTER, `'${NUR_MOD}'`),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  // Ausgangslage: Anna und Ben sind verifiziert, der Fremde nicht.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users', ANNA), konto({ pseudonym: 'Anna' }))
    await setDoc(doc(db, 'users', BEN), konto({ pseudonym: 'Ben' }))
    await setDoc(doc(db, 'users', FREMD), konto({ verificationStatus: 'offen' }))
  })
})

const als = (uid: string) => env.authenticatedContext(uid).firestore()

describe('Konten', () => {
  it('lässt niemanden ein fremdes Konto lesen', async () => {
    await assertFails(getDoc(doc(als(BEN), 'users', ANNA)))
  })

  it('lässt die Moderation jedes Konto lesen', async () => {
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'users', ANNA)))
  })

  it('verhindert die Selbstfreigabe', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', FREMD), konto({ verificationStatus: 'offen' }))
    })
    await assertFails(updateDoc(doc(als(FREMD), 'users', FREMD), { verificationStatus: 'verifiziert' }))
    await assertFails(updateDoc(doc(als(FREMD), 'users', FREMD), { verificationStatus: 'abgelehnt' }))
  })

  it('verhindert den selbst gesetzten Tarif', async () => {
    await assertFails(
      updateDoc(doc(als(ANNA), 'users', ANNA), {
        membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
      }),
    )
  })

  it('erlaubt der Moderation, einen Tarif zu vergeben', async () => {
    await assertSucceeds(
      updateDoc(doc(als(MODERATOR), 'users', ANNA), {
        membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
        geaendertVon: MODERATOR,
      }),
    )
  })

  it('erlaubt das Einreichen und Zurückziehen eines Antrags', async () => {
    await assertSucceeds(updateDoc(doc(als(FREMD), 'users', FREMD), { verificationStatus: 'wartet' }))
    await assertSucceeds(updateDoc(doc(als(FREMD), 'users', FREMD), { verificationStatus: 'offen' }))
  })

  it('erlaubt das eigene Profil', async () => {
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users', ANNA), { pseudonym: 'Anderer Name' }))
  })
})

describe('Warteschlange', () => {
  it('lässt nur verifizierte Konten hinein', async () => {
    await assertSucceeds(setDoc(doc(als(ANNA), 'queue', ANNA), warteEintrag(ANNA)))
    await assertFails(setDoc(doc(als(FREMD), 'queue', FREMD), warteEintrag(FREMD)))
  })

  it('hält ein Konto draussen, dem nur das alte Feld auf true steht', async () => {
    // Der Prüfstand hängt allein an `verificationStatus`. Ein übrig
    // gebliebenes `verified: true` öffnet nichts mehr.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', FREMD), konto({ verificationStatus: 'offen', verified: true }))
    })
    await assertFails(setDoc(doc(als(FREMD), 'queue', FREMD), warteEintrag(FREMD)))
  })

  it('hält gesperrte Konten draussen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'blocked', ANNA), { at: '2026-01-01T00:00:00.000Z' })
    })
    await assertFails(setDoc(doc(als(ANNA), 'queue', ANNA), warteEintrag(ANNA)))
  })

  it('lässt niemanden im fremden Namen warten', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'queue', BEN), warteEintrag(BEN)))
  })

  it('erlaubt genau einen Zugriff auf den fremden Eintrag: die Raumnummer', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'queue', ANNA), warteEintrag(ANNA))
      await setDoc(doc(ctx.firestore(), 'queue', BEN), warteEintrag(BEN))
    })
    await assertFails(updateDoc(doc(als(ANNA), 'queue', BEN), { pseudonym: 'Untergeschoben' }))
    await assertSucceeds(updateDoc(doc(als(ANNA), 'queue', BEN), { roomId: 'raum-1' }))
    // Ein zweites Mal nicht: der Eintrag ist vergeben.
    await assertFails(updateDoc(doc(als(FREMD), 'queue', BEN), { roomId: 'raum-2' }))
  })

  it('lässt nur Suchende eine Raumnummer eintragen', async () => {
    // Anna ist verifiziert, sucht aber nicht. Dann hat sie an Bens Eintrag
    // auch nichts zu suchen – sonst kann jedes verifizierte Konto reihenweise
    // Wartende mit erfundenen Raumnummern blockieren.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'queue', BEN), warteEintrag(BEN))
    })
    await assertFails(updateDoc(doc(als(ANNA), 'queue', BEN), { roomId: 'raum-1' }))
  })
})

describe('Chaträume', () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'raum-1'), raum())
    })
  })

  it('lässt keinen Raum mit einer ahnungslosen Person entstehen', async () => {
    // Ohne diese Regel legt ein verifiziertes Konto einen Raum mit einem
    // beliebigen Gegenüber an, schreibt darin und meldet ihn – die Moderation
    // bekäme ein Gespräch vorgelegt, das nie stattgefunden hat.
    await assertFails(setDoc(doc(als(ANNA), 'chats', 'raum-2'), raum({ id: 'raum-2' })))

    // Suchen beide, ist es ein echter Treffer.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'queue', ANNA), warteEintrag(ANNA))
      await setDoc(doc(ctx.firestore(), 'queue', BEN), warteEintrag(BEN))
    })
    await assertSucceeds(setDoc(doc(als(ANNA), 'chats', 'raum-2'), raum({ id: 'raum-2' })))
  })

  it('lässt niemanden einen Raum ohne sich selbst anlegen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'queue', ANNA), warteEintrag(ANNA))
      await setDoc(doc(ctx.firestore(), 'queue', BEN), warteEintrag(BEN))
    })
    await assertFails(
      setDoc(doc(als(FREMD), 'chats', 'raum-3'), raum({ id: 'raum-3' })),
    )
  })

  it('lässt nur Beteiligte lesen', async () => {
    await assertSucceeds(getDoc(doc(als(ANNA), 'chats', 'raum-1')))
    await assertFails(getDoc(doc(als(FREMD), 'chats', 'raum-1')))
  })

  it('lässt die Moderation lesen, aber nur innerhalb der Frist', async () => {
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'chats', 'raum-1')))
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), 'chats', 'raum-alt'),
        raum({ id: 'raum-alt', expiresAt: Timestamp.fromMillis(Date.now() - 1000) }),
      )
    })
    await assertFails(getDoc(doc(als(MODERATOR), 'chats', 'raum-alt')))
  })

  it('lässt niemanden ausser der Moderation Räume auflisten', async () => {
    await assertSucceeds(getDocs(collection(als(MODERATOR), 'chats')))
    await assertFails(getDocs(collection(als(ANNA), 'chats')))
  })

  it('lässt Beteiligte nur Zähler und Zustände ändern', async () => {
    await assertSucceeds(updateDoc(doc(als(ANNA), 'chats', 'raum-1'), { [`typing.${ANNA}`]: Date.now() }))
    await assertSucceeds(updateDoc(doc(als(ANNA), 'chats', 'raum-1'), { reported: true }))
    await assertFails(updateDoc(doc(als(ANNA), 'chats', 'raum-1'), { participants: [ANNA, FREMD] }))
    await assertFails(
      updateDoc(doc(als(ANNA), 'chats', 'raum-1'), {
        expiresAt: Timestamp.fromMillis(Date.now() + 999_000_000),
      }),
    )
  })
})

describe('Nachrichten', () => {
  const nachricht = (author: string) => ({
    author,
    text: 'Hallo',
    ts: Timestamp.now(),
    flag: null,
    expiresAt: Timestamp.fromMillis(Date.now() + 3_600_000),
  })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'raum-1'), raum())
    })
  })

  it('lässt Beteiligte schreiben und lesen', async () => {
    await assertSucceeds(setDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm1'), nachricht(ANNA)))
    await assertSucceeds(getDoc(doc(als(BEN), 'chats/raum-1/messages', 'm1')))
  })

  it('lässt Fremde weder schreiben noch lesen', async () => {
    await assertFails(setDoc(doc(als(FREMD), 'chats/raum-1/messages', 'm2'), nachricht(FREMD)))
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats/raum-1/messages', 'm1'), nachricht(ANNA))
    })
    await assertFails(getDoc(doc(als(FREMD), 'chats/raum-1/messages', 'm1')))
  })

  it('lässt niemanden im fremden Namen schreiben', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm3'), nachricht(BEN)))
  })

  it('lässt Geschriebenes nicht mehr ändern', async () => {
    await setDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm1'), nachricht(ANNA))
    await assertFails(updateDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm1'), { text: 'War nie so gemeint' }))
  })

  it('weist leere und überlange Nachrichten ab', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm4'), { ...nachricht(ANNA), text: '' }))
    await assertFails(
      setDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm5'), { ...nachricht(ANNA), text: 'x'.repeat(2001) }),
    )
  })

  it('lässt die Moderation mitlesen', async () => {
    await setDoc(doc(als(ANNA), 'chats/raum-1/messages', 'm1'), nachricht(ANNA))
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'chats/raum-1/messages', 'm1')))
  })
})

describe('Supportanfragen', () => {
  const anfrage = (userId: string, patch: Record<string, unknown> = {}) => ({
    id: 'sup-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    userId,
    pseudonym: 'Anna',
    thema: 'geschlecht',
    betreff: 'Falsches Geschlecht gewählt',
    text: 'Ich habe bei der Anmeldung versehentlich das falsche Geschlecht angegeben.',
    antwortAn: 'anna@beispiel.ch',
    verifizierung: 'verifiziert',
    plan: 'frei',
    anhaenge: [],
    status: 'offen',
    ...patch,
  })

  it('lässt die eigene Anfrage anlegen und den Stand nachlesen', async () => {
    // Anders als bei einer Meldung: Wer nicht sieht, ob die Anfrage
    // angekommen ist, schreibt sie ein zweites Mal.
    await assertSucceeds(setDoc(doc(als(ANNA), 'support', 'sup-1'), anfrage(ANNA)))
    await assertSucceeds(getDoc(doc(als(ANNA), 'support', 'sup-1')))
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'support', 'sup-1')))
  })

  it('lässt niemanden eine fremde Anfrage lesen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'support', 'sup-1'), anfrage(ANNA))
    })
    await assertFails(getDoc(doc(als(BEN), 'support', 'sup-1')))
  })

  it('lässt niemanden im fremden Namen schreiben', async () => {
    await assertFails(setDoc(doc(als(BEN), 'support', 'sup-2'), anfrage(ANNA, { id: 'sup-2' })))
  })

  it('verhindert die selbst erledigte Anfrage', async () => {
    // Sonst könnte sich jemand die eigene Anfrage vom Tisch räumen – oder,
    // schlimmer, sie nachträglich umschreiben, nachdem entschieden wurde.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'support', 'sup-1'), anfrage(ANNA))
    })
    await assertFails(updateDoc(doc(als(ANNA), 'support', 'sup-1'), { status: 'erledigt' }))
    await assertFails(updateDoc(doc(als(ANNA), 'support', 'sup-1'), { text: 'Ganz was anderes' }))
    await assertFails(deleteDoc(doc(als(ANNA), 'support', 'sup-1')))
    await assertSucceeds(
      updateDoc(doc(als(MODERATOR), 'support', 'sup-1'), { status: 'erledigt', bearbeitetVon: MODERATOR }),
    )
  })

  it('weist leere und übergrosse Anfragen ab', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-3'), anfrage(ANNA, { id: 'sup-3', text: '' })))
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-4'), anfrage(ANNA, { id: 'sup-4', betreff: '' })))
    await assertFails(
      setDoc(doc(als(ANNA), 'support', 'sup-5'), anfrage(ANNA, { id: 'sup-5', text: 'x'.repeat(2001) })),
    )
  })

  it('begrenzt die Zahl der Anhänge', async () => {
    const drei = ['support/a/b/0.jpg', 'support/a/b/1.jpg', 'support/a/b/2.jpg']
    await assertSucceeds(setDoc(doc(als(ANNA), 'support', 'sup-7'), anfrage(ANNA, { id: 'sup-7', anhaenge: drei })))
    await assertFails(
      setDoc(doc(als(ANNA), 'support', 'sup-8'), anfrage(ANNA, { id: 'sup-8', anhaenge: [...drei, 'support/a/b/3.jpg'] })),
    )
  })

  it('lässt sich nicht als bereits erledigt einreichen', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-6'), anfrage(ANNA, { id: 'sup-6', status: 'erledigt' })))
  })

  it('lässt die Moderation erledigte Anfragen löschen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'support', 'sup-9'), anfrage(ANNA, { id: 'sup-9', status: 'erledigt' }))
    })
    await assertSucceeds(deleteDoc(doc(als(MODERATOR), 'support', 'sup-9')))
  })

  it('lässt keine offene Anfrage löschen, auch nicht durch die Moderation', async () => {
    // Eine offene Anfrage hat noch niemand bearbeitet. Ein Fehlklick darf sie
    // nicht verschwinden lassen – deshalb sitzt die Sperre auf dem Server und
    // nicht nur als ausgeblendeter Knopf in der Oberfläche.
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'support', 'sup-10'), anfrage(ANNA, { id: 'sup-10', status: 'offen' }))
      await setDoc(doc(ctx.firestore(), 'support', 'sup-11'), anfrage(ANNA, { id: 'sup-11', status: 'inArbeit' }))
    })
    await assertFails(deleteDoc(doc(als(MODERATOR), 'support', 'sup-10')))
    await assertFails(deleteDoc(doc(als(MODERATOR), 'support', 'sup-11')))
  })
})

describe('Supportchat', () => {
  const anfrage = (patch: Record<string, unknown> = {}) => ({
    id: 'sup-c',
    createdAt: '2026-01-01T00:00:00.000Z',
    userId: ANNA,
    pseudonym: 'Anna',
    thema: 'sonstiges',
    betreff: 'Frage',
    text: 'Eine Frage an den Support, lang genug.',
    antwortAn: 'anna@beispiel.ch',
    verifizierung: 'verifiziert',
    plan: 'frei',
    anhaenge: [],
    status: 'inArbeit',
    chatOffen: true,
    ungelesenNutzer: false,
    ungelesenModeration: false,
    ...patch,
  })
  const nachricht = (von: string, text = 'Hallo') => ({ von, text, at: serverTimestamp() })
  const ablegen = async (patch: Record<string, unknown> = {}) => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'support', 'sup-c'), anfrage(patch))
    })
  }
  const pfad = 'support/sup-c/nachrichten'

  it('lässt beim Anlegen keinen Chat selbst eröffnen', async () => {
    // Einen Chat eröffnet nur die Moderation.
    const neu = { ...anfrage({ id: 'sup-x', status: 'offen' }) }
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-x'), neu))
    await assertSucceeds(
      setDoc(doc(als(ANNA), 'support', 'sup-y'), {
        ...neu,
        id: 'sup-y',
        chatOffen: false,
        ungelesenNutzer: false,
        ungelesenModeration: false,
      }),
    )
  })

  it('lässt beide Seiten in einem eröffneten Chat schreiben und lesen', async () => {
    await ablegen()
    await assertSucceeds(setDoc(doc(als(MODERATOR), pfad, 'n1'), nachricht('moderation')))
    await assertSucceeds(setDoc(doc(als(ANNA), pfad, 'n2'), nachricht('nutzer')))
    await assertSucceeds(getDocs(collection(als(ANNA), pfad)))
    await assertSucceeds(getDocs(collection(als(MODERATOR), pfad)))
  })

  it('lässt ohne eröffneten Chat niemanden schreiben', async () => {
    await ablegen({ chatOffen: false })
    await assertFails(setDoc(doc(als(ANNA), pfad, 'n1'), nachricht('nutzer')))
    await assertFails(setDoc(doc(als(MODERATOR), pfad, 'n2'), nachricht('moderation')))
  })

  it('schliesst den Chat für die Person, sobald die Anfrage erledigt ist', async () => {
    await ablegen({ status: 'erledigt' })
    await assertFails(setDoc(doc(als(ANNA), pfad, 'n1'), nachricht('nutzer')))
    // Lesen bleibt möglich: Was besprochen wurde, soll nicht verschwinden.
    await assertSucceeds(getDocs(collection(als(ANNA), pfad)))
  })

  it('lässt niemanden sich als Support ausgeben', async () => {
    await ablegen()
    await assertFails(setDoc(doc(als(ANNA), pfad, 'n1'), nachricht('moderation')))
  })

  it('hält Fremde aus dem Chat heraus', async () => {
    await ablegen()
    await assertFails(getDocs(collection(als(BEN), pfad)))
    await assertFails(setDoc(doc(als(BEN), pfad, 'n1'), nachricht('nutzer')))
  })

  it('lässt Geschriebenes nicht mehr ändern', async () => {
    await ablegen()
    await setDoc(doc(als(ANNA), pfad, 'n1'), nachricht('nutzer'))
    await assertFails(updateDoc(doc(als(ANNA), pfad, 'n1'), { text: 'Anders gemeint' }))
    await assertFails(deleteDoc(doc(als(ANNA), pfad, 'n1')))
  })

  it('verlangt die Serverzeit, keine erfundene', async () => {
    await ablegen()
    await assertFails(setDoc(doc(als(ANNA), pfad, 'n1'), { von: 'nutzer', text: 'Hallo', at: Timestamp.fromMillis(0) }))
  })

  it('lässt die Person nur "gelesen" und "geantwortet" markieren', async () => {
    await ablegen({ ungelesenNutzer: true })
    // gelesen
    await assertSucceeds(updateDoc(doc(als(ANNA), 'support', 'sup-c'), { ungelesenNutzer: false }))
    // geantwortet: Nachricht und Markierung zusammen, wie die App es tut.
    // Eine Instanz für den ganzen Stapel – `als()` erzeugt bei jedem Aufruf
    // eine neue, und ein Stapel nimmt nur Dokumente derselben an.
    const anna = als(ANNA)
    const stapel = writeBatch(anna)
    stapel.set(doc(anna, pfad, 'n1'), nachricht('nutzer'))
    stapel.update(doc(anna, 'support', 'sup-c'), { ungelesenModeration: true, ungelesenNutzer: false })
    await assertSucceeds(stapel.commit())
  })

  it('lässt die Person eine Antwort nicht vor der Moderation verstecken', async () => {
    await ablegen({ ungelesenModeration: true })
    await assertFails(updateDoc(doc(als(ANNA), 'support', 'sup-c'), { ungelesenModeration: false }))
  })

  it('lässt die Person weder Stand noch Chat selbst ändern', async () => {
    await ablegen()
    await assertFails(updateDoc(doc(als(ANNA), 'support', 'sup-c'), { chatOffen: false }))
    await assertFails(updateDoc(doc(als(ANNA), 'support', 'sup-c'), { status: 'offen' }))
  })

  it('lässt ohne eröffneten Chat auch keine Markierung setzen', async () => {
    // Sonst liesse sich das Abzeichen der Moderation von aussen hochzählen.
    await ablegen({ chatOffen: false })
    await assertFails(updateDoc(doc(als(ANNA), 'support', 'sup-c'), { ungelesenModeration: true }))
  })
})

describe('Meldungen und Protokoll', () => {
  it('lässt melden, aber nicht mitlesen', async () => {
    const meldung = {
      id: 'rep-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      reporterId: ANNA,
      reporterPseudonym: 'Anna',
      reportedId: BEN,
      reportedPseudonym: 'Ben',
      reason: 'spam',
      note: '',
      excerpt: [],
      autoFlags: 0,
      transcriptId: 'raum-1',
      status: 'offen',
    }
    await assertSucceeds(setDoc(doc(als(ANNA), 'reports', 'rep-1'), meldung))
    await assertFails(getDoc(doc(als(ANNA), 'reports', 'rep-1')))
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'reports', 'rep-1')))
  })

  it('lässt das Zugriffsprotokoll nicht nachträglich aufräumen', async () => {
    const eintrag = {
      id: 'log-1',
      at: '2026-01-01T00:00:00.000Z',
      transcriptId: 'raum-1',
      by: 'Moderation',
      action: 'geoeffnet',
    }
    await assertSucceeds(setDoc(doc(als(MODERATOR), 'accessLog', 'log-1'), eintrag))
    await assertFails(updateDoc(doc(als(MODERATOR), 'accessLog', 'log-1'), { by: 'jemand anderes' }))
  })
})

describe('Verifizierungsanträge', () => {
  const antrag = (userId: string) => ({
    id: 'ver-1',
    userId,
    pseudonym: 'Anna',
    phoneMasked: '+41 •• ••• •• 67',
    submittedAt: Timestamp.now(),
    status: 'wartet',
    decidedAt: null,
    decidedBy: null,
    rejectionReason: null,
    documents: {
      ausweis: { name: 'a.jpg', size: 1, type: 'image/jpeg' },
      selfie: { name: 's.jpg', size: 1, type: 'image/jpeg' },
    },
  })

  it('lässt nur den eigenen Antrag einreichen und lesen', async () => {
    await assertSucceeds(setDoc(doc(als(ANNA), 'verifications', 'ver-1'), antrag(ANNA)))
    await assertFails(setDoc(doc(als(BEN), 'verifications', 'ver-2'), antrag(ANNA)))
    await assertFails(getDoc(doc(als(BEN), 'verifications', 'ver-1')))
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'verifications', 'ver-1')))
  })

  it('lässt nur die Moderation entscheiden', async () => {
    await setDoc(doc(als(ANNA), 'verifications', 'ver-1'), antrag(ANNA))
    await assertFails(updateDoc(doc(als(ANNA), 'verifications', 'ver-1'), { status: 'freigegeben' }))
    await assertSucceeds(updateDoc(doc(als(MODERATOR), 'verifications', 'ver-1'), { status: 'freigegeben' }))
  })
})

describe('Geschlechtsangabe', () => {
  it('lässt sie genau einmal setzen', async () => {
    // Die Ausgangslage hat das Feld gar nicht – wie bei Konten aus der Zeit
    // davor. Auch dann muss die Regel greifen.
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users', ANNA), { geschlecht: 'weiblich' }))
    await assertFails(updateDoc(doc(als(ANNA), 'users', ANNA), { geschlecht: 'maennlich' }))
  })

  it('weist erfundene Angaben ab', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users', ANNA), { geschlecht: 'irgendwas' }))
    await assertFails(updateDoc(doc(als(ANNA), 'users', ANNA), { geschlecht: 42 }))
  })

  it('lässt das übrige Profil weiter ändern, solange die Angabe gleich bleibt', async () => {
    await updateDoc(doc(als(ANNA), 'users', ANNA), { geschlecht: 'weiblich' })
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users', ANNA), { pseudonym: 'Stille Amsel 2098' }))
    await assertFails(
      updateDoc(doc(als(ANNA), 'users', ANNA), { pseudonym: 'Blauer Falke 1111', geschlecht: 'maennlich' }),
    )
  })

  it('lässt die Moderation korrigieren, samt Namen', async () => {
    await updateDoc(doc(als(ANNA), 'users', ANNA), { geschlecht: 'weiblich' })
    await assertSucceeds(
      updateDoc(doc(als(NUR_MOD), 'users', ANNA), {
        geschlecht: 'maennlich',
        pseudonym: 'Blauer Falke 4417',
        geaendertVon: NUR_MOD,
      }),
    )
  })

  it('lässt die Moderation dabei nicht am Tarif drehen', async () => {
    await assertFails(
      updateDoc(doc(als(NUR_MOD), 'users', ANNA), {
        geschlecht: 'maennlich',
        membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
      }),
    )
  })

  it('lässt niemanden an einem fremden Konto drehen', async () => {
    await assertFails(updateDoc(doc(als(BEN), 'users', ANNA), { geschlecht: 'maennlich' }))
  })
})

describe('Rollentrennung', () => {
  it('lässt reine Moderation über Verifizierungen entscheiden', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'verifications', 'ver-1'), {
        id: 'ver-1',
        userId: ANNA,
        pseudonym: 'Anna',
        phoneMasked: '+41 xx',
        submittedAt: Timestamp.now(),
        status: 'wartet',
        decidedAt: null,
        decidedBy: null,
        rejectionReason: null,
      })
    })
    await assertSucceeds(updateDoc(doc(als(NUR_MOD), 'verifications', 'ver-1'), { status: 'freigegeben' }))
    await assertSucceeds(
      updateDoc(doc(als(NUR_MOD), 'users', ANNA), {
        verificationStatus: 'verifiziert',
        verifiedAt: '2026-01-01T00:00:00.000Z',
      }),
    )
  })

  it('lässt reine Moderation keine Tarife vergeben', async () => {
    await assertFails(
      updateDoc(doc(als(NUR_MOD), 'users', ANNA), {
        membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
      }),
    )
    await assertSucceeds(
      updateDoc(doc(als(MODERATOR), 'users', ANNA), {
        membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
        geaendertVon: MODERATOR,
      }),
    )
  })

  it('lässt reine Moderation den Namen ändern – das ist der Supportfall', async () => {
    // Eine Korrektur der Geschlechtsangabe muss den Namen neu setzen, sonst
    // widerspräche er ihr. Damit kann die Moderation umbenennen; das ist der
    // Preis dafür und im Zugriffsprotokoll nicht sichtbar. Weiter reicht es
    // aber nicht.
    await assertSucceeds(updateDoc(doc(als(NUR_MOD), 'users', ANNA), { pseudonym: 'Blauer Falke 4417' }))
    await assertFails(
      updateDoc(doc(als(NUR_MOD), 'users', ANNA), {
        profile: { language: 'fr', ageGroup: '50+', interests: [] },
      }),
    )
    await assertFails(updateDoc(doc(als(NUR_MOD), 'users', ANNA), { selfBlocked: ['konto-ben'] }))
  })

  it('lässt reine Moderation Meldungen und Verläufe bearbeiten', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'chats', 'raum-1'), raum())
      await setDoc(doc(ctx.firestore(), 'blocked', BEN), { at: '2026-01-01T00:00:00.000Z' })
    })
    await assertSucceeds(getDocs(collection(als(NUR_MOD), 'chats')))
    await assertSucceeds(setDoc(doc(als(NUR_MOD), 'blocked', FREMD), { at: '2026-01-01T00:00:00.000Z' }))
    await assertSucceeds(
      setDoc(doc(als(NUR_MOD), 'accessLog', 'log-2'), {
        id: 'log-2',
        at: '2026-01-01T00:00:00.000Z',
        transcriptId: 'raum-1',
        by: 'Moderation',
        action: 'geoeffnet',
      }),
    )
  })

  it('lässt auch die Verwaltung das Zugriffsprotokoll nicht löschen', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'accessLog', 'log-3'), {
        id: 'log-3',
        at: '2026-01-01T00:00:00.000Z',
        transcriptId: 'raum-1',
        by: 'Moderation',
        action: 'geoeffnet',
      })
    })
    await assertFails(deleteDoc(doc(als(MODERATOR), 'accessLog', 'log-3')))
    await assertFails(deleteDoc(doc(als(NUR_MOD), 'accessLog', 'log-3')))
  })

  it('lässt gewöhnliche Konten nichts davon', async () => {
    await assertFails(getDocs(collection(als(ANNA), 'chats')))
    await assertFails(updateDoc(doc(als(ANNA), 'users', BEN), { verificationStatus: 'verifiziert' }))
  })
})

describe('Tarifwünsche', () => {
  const wunsch = (userId: string, patch: Record<string, unknown> = {}) => ({
    userId,
    pseudonym: 'Anna',
    plan: 'lifetime',
    at: '2026-01-01T00:00:00.000Z',
    erledigt: false,
    ...patch,
  })

  it('lässt jeden den eigenen Wunsch eintragen und lesen', async () => {
    await assertSucceeds(setDoc(doc(als(ANNA), 'planRequests', ANNA), wunsch(ANNA)))
    await assertSucceeds(getDoc(doc(als(ANNA), 'planRequests', ANNA)))
  })

  it('lässt niemanden im fremden Namen wünschen oder mitlesen', async () => {
    await assertFails(setDoc(doc(als(BEN), 'planRequests', ANNA), wunsch(ANNA)))
    await setDoc(doc(als(ANNA), 'planRequests', ANNA), wunsch(ANNA))
    await assertFails(getDoc(doc(als(BEN), 'planRequests', ANNA)))
  })

  it('lässt niemanden den eigenen Wunsch als erledigt ausgeben', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'planRequests', ANNA), wunsch(ANNA, { erledigt: true })))
  })

  it('macht aus einem Wunsch keinen Zugang', async () => {
    await setDoc(doc(als(ANNA), 'planRequests', ANNA), wunsch(ANNA))
    await assertFails(
      updateDoc(doc(als(ANNA), 'users', ANNA), {
        membership: { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null },
      }),
    )
  })

  it('lässt die Verwaltung lesen und erledigen', async () => {
    await setDoc(doc(als(ANNA), 'planRequests', ANNA), wunsch(ANNA))
    await assertSucceeds(getDoc(doc(als(MODERATOR), 'planRequests', ANNA)))
    await assertSucceeds(updateDoc(doc(als(MODERATOR), 'planRequests', ANNA), { erledigt: true }))
  })

  it('lässt reine Moderation lesen, aber nicht abhaken', async () => {
    await setDoc(doc(als(ANNA), 'planRequests', ANNA), wunsch(ANNA))
    await assertSucceeds(getDoc(doc(als(NUR_MOD), 'planRequests', ANNA)))
    await assertFails(updateDoc(doc(als(NUR_MOD), 'planRequests', ANNA), { erledigt: true }))
  })
})

describe('Sperrliste', () => {
  it('bleibt der Moderation vorbehalten', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'blocked', BEN), { at: '2026-01-01T00:00:00.000Z' }))
    await assertFails(getDocs(query(collection(als(ANNA), 'blocked'), where('at', '>', ''))))
    await assertSucceeds(setDoc(doc(als(MODERATOR), 'blocked', BEN), { at: '2026-01-01T00:00:00.000Z' }))
  })
})

describe('Protokoll: wer es war', () => {
  // Der Auslöser für das Discord-Protokoll liest die Kennung aus dem
  // Dokument. Stimmt sie nicht, steht jemand Falsches im Protokoll – oder
  // niemand. Beides muss die Regel verhindern.
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, 'support', 'sup-p'), {
        id: 'sup-p',
        userId: ANNA,
        status: 'offen',
        thema: 'tarif',
        betreff: 'Frage',
        text: 'Eine Frage zum Tarif, lang genug.',
        anhaenge: [],
      })
      await setDoc(doc(db, 'reports', 'rep-p'), {
        id: 'rep-p',
        reporterId: ANNA,
        reportedId: BEN,
        reason: 'spam',
        status: 'offen',
      })
      await setDoc(doc(db, 'users', ANNA), konto({ pseudonym: 'Anna', geschlecht: 'weiblich' }))
    })
  })

  it('verlangt beim Supportstand die eigene Kennung', async () => {
    await assertFails(updateDoc(doc(als(NUR_MOD), 'support', 'sup-p'), { status: 'inArbeit' }))
    await assertFails(updateDoc(doc(als(NUR_MOD), 'support', 'sup-p'), { status: 'inArbeit', bearbeitetVon: MODERATOR }))
    await assertSucceeds(updateDoc(doc(als(NUR_MOD), 'support', 'sup-p'), { status: 'inArbeit', bearbeitetVon: NUR_MOD }))
    // Ohne Standwechsel (z. B. Markierung "gelesen") braucht es keine.
    await assertSucceeds(updateDoc(doc(als(NUR_MOD), 'support', 'sup-p'), { ungelesenModeration: false }))
  })

  it('verlangt beim Meldungsstand die eigene Kennung', async () => {
    await assertFails(updateDoc(doc(als(NUR_MOD), 'reports', 'rep-p'), { status: 'gesperrt' }))
    await assertFails(updateDoc(doc(als(NUR_MOD), 'reports', 'rep-p'), { status: 'gesperrt', bearbeitetVon: MODERATOR }))
    await assertSucceeds(updateDoc(doc(als(NUR_MOD), 'reports', 'rep-p'), { status: 'gesperrt', bearbeitetVon: NUR_MOD }))
  })

  it('verlangt bei Tarif und Geschlecht die eigene Kennung', async () => {
    const lifetime = { plan: 'lifetime', seit: '2026-01-01T00:00:00.000Z', bis: null }
    await assertFails(updateDoc(doc(als(MODERATOR), 'users', ANNA), { membership: lifetime }))
    await assertFails(updateDoc(doc(als(MODERATOR), 'users', ANNA), { membership: lifetime, geaendertVon: NUR_MOD }))
    await assertFails(updateDoc(doc(als(NUR_MOD), 'users', ANNA), { geschlecht: 'maennlich' }))
    await assertFails(updateDoc(doc(als(NUR_MOD), 'users', ANNA), { geschlecht: 'maennlich', geaendertVon: MODERATOR }))
    // Entscheidungen, die weder Tarif noch Geschlecht berühren, bleiben frei.
    await assertSucceeds(updateDoc(doc(als(NUR_MOD), 'users', ANNA), { verificationStatus: 'verifiziert' }))
  })

  it('lässt das eigene Zurücksetzen zu, solange der Eintrag bleibt', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', ANNA), konto({ geschlecht: 'weiblich', geaendertVon: MODERATOR }))
    })
    // So schreibt resetIdentity(): alles neu, Tarif, Geschlecht und Eintrag bleiben.
    await assertSucceeds(
      setDoc(doc(als(ANNA), 'users', ANNA), konto({ pseudonym: 'Neu 1', geschlecht: 'weiblich', geaendertVon: MODERATOR })),
    )
    await assertFails(setDoc(doc(als(ANNA), 'users', ANNA), konto({ pseudonym: 'Neu 2', geschlecht: 'weiblich' })))
  })

  it('lässt die Person selbst niemanden eintragen', async () => {
    await assertFails(updateDoc(doc(als(ANNA), 'users', ANNA), { geaendertVon: MODERATOR }))
    await assertFails(updateDoc(doc(als(ANNA), 'users', ANNA), { geaendertVon: ANNA }))
    await assertSucceeds(updateDoc(doc(als(ANNA), 'users', ANNA), { pseudonym: 'Stille Amsel 2098' }))
  })
})

describe('Discord-Nachrichten', () => {
  // Welche Discord-Nachricht zu welchem Fall gehört, weiss nur der Server.
  it('ist für die App weder lesbar noch schreibbar', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'discordNachrichten', 'sup-1'), { ids: ['1'] })
    })
    await assertFails(getDoc(doc(als(MODERATOR), 'discordNachrichten', 'sup-1')))
    await assertFails(getDoc(doc(als(ANNA), 'discordNachrichten', 'sup-1')))
    await assertFails(setDoc(doc(als(MODERATOR), 'discordNachrichten', 'sup-2'), { ids: ['2'] }))
  })
})

describe('Aktionen', () => {
  const aktion = (patch: Record<string, unknown> = {}) => ({
    name: 'Release',
    aktiv: true,
    start: '2026-10-01T00:00:00.000Z',
    gratisTage: 14,
    rabattProzent: 20,
    rabattTage: 30,
    tarife: ['plus-monat', 'plus-jahr', 'lifetime'],
    aboDauer: 'einmal',
    aboMonate: 1,
    code: null,
    hinweisTitel: '',
    hinweisText: '',
    geaendertVon: MODERATOR,
    ...patch,
  })
  const gutschein = (patch: Record<string, unknown> = {}) =>
    aktion({ name: 'Sommer', gratisTage: 0, rabattProzent: 25, code: 'SOMMER25', ...patch })

  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'aktionen', 'release'), aktion())
      await setDoc(doc(ctx.firestore(), 'aktionen', 'code-SOMMER25'), gutschein())
    })
  })

  it('zeigt öffentliche Aktionen allen, auch ohne Anmeldung', async () => {
    const gast = env.unauthenticatedContext().firestore()
    await assertSucceeds(getDocs(query(collection(gast, 'aktionen'), where('code', '==', null))))
    await assertSucceeds(getDoc(doc(gast, 'aktionen', 'release')))
  })

  it('lässt Gutscheine nicht auflisten – nur mit Code abrufen', async () => {
    const gast = env.unauthenticatedContext().firestore()
    await assertFails(getDocs(collection(gast, 'aktionen')))
    await assertFails(getDocs(collection(als(ANNA), 'aktionen')))
    await assertSucceeds(getDoc(doc(gast, 'aktionen', 'code-SOMMER25')))
    await assertSucceeds(getDocs(collection(als(MODERATOR), 'aktionen')))
  })

  it('lässt nur die Verwaltung schreiben – mit eigener Kennung', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'aktionen', 'neu'), aktion({ geaendertVon: ANNA })))
    await assertFails(setDoc(doc(als(NUR_MOD), 'aktionen', 'neu'), aktion({ geaendertVon: NUR_MOD })))
    await assertFails(setDoc(doc(als(MODERATOR), 'aktionen', 'neu'), aktion({ geaendertVon: NUR_MOD })))
    await assertSucceeds(setDoc(doc(als(MODERATOR), 'aktionen', 'neu'), aktion()))
    await assertFails(deleteDoc(doc(als(ANNA), 'aktionen', 'release')))
    await assertSucceeds(deleteDoc(doc(als(MODERATOR), 'aktionen', 'release')))
  })

  it('verlangt für Gutscheine die passende Kennung und nichts Gratis', async () => {
    const db = als(MODERATOR)
    await assertSucceeds(setDoc(doc(db, 'aktionen', 'code-HERBST10'), gutschein({ code: 'HERBST10' })))
    await assertFails(setDoc(doc(db, 'aktionen', 'code-FALSCH'), gutschein({ code: 'HERBST10' })))
    await assertFails(setDoc(doc(db, 'aktionen', 'irgendwas'), gutschein({ code: 'HERBST10' })))
    await assertFails(setDoc(doc(db, 'aktionen', 'code-TARN'), aktion()))
    await assertFails(setDoc(doc(db, 'aktionen', 'code-GRATIS'), gutschein({ code: 'GRATIS', gratisTage: 5 })))
    await assertFails(setDoc(doc(db, 'aktionen', 'code-ab'), gutschein({ code: 'ab' })))
  })

  it('weist Werte ausserhalb der Grenzen ab', async () => {
    const ref = doc(als(MODERATOR), 'aktionen', 'neu')
    await assertFails(setDoc(ref, aktion({ rabattProzent: 100 })))
    await assertFails(setDoc(ref, aktion({ gratisTage: -1 })))
    await assertFails(setDoc(ref, aktion({ rabattTage: 1.5 })))
    await assertFails(setDoc(ref, aktion({ start: null })))
    await assertFails(setDoc(ref, aktion({ tarife: ['frei'] })))
    await assertFails(setDoc(ref, aktion({ aboDauer: 'immer' })))
    await assertFails(setDoc(ref, aktion({ name: '' })))
    await assertFails(setDoc(ref, aktion({ gratisFuerImmer: true })))
    await assertSucceeds(setDoc(ref, aktion({ aktiv: false, start: null })))
  })

  it('nimmt im Tarifwunsch nur Codes an, die es gibt', async () => {
    const wunschMit = (code: unknown) => ({
      userId: ANNA,
      pseudonym: 'Anna',
      plan: 'plus-jahr',
      at: '2026-10-02T00:00:00.000Z',
      erledigt: false,
      code,
    })
    await assertFails(setDoc(doc(als(ANNA), 'planRequests', ANNA), wunschMit('ERFUNDEN50')))
    await assertSucceeds(setDoc(doc(als(ANNA), 'planRequests', ANNA), wunschMit('SOMMER25')))
    await assertSucceeds(setDoc(doc(als(ANNA), 'planRequests', ANNA), wunschMit(null)))
  })
})
