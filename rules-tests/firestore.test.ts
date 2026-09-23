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
  setDoc,
  updateDoc,
  where,
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
    await assertSucceeds(updateDoc(doc(als(MODERATOR), 'support', 'sup-1'), { status: 'erledigt' }))
  })

  it('weist leere und übergrosse Anfragen ab', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-3'), anfrage(ANNA, { id: 'sup-3', text: '' })))
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-4'), anfrage(ANNA, { id: 'sup-4', betreff: '' })))
    await assertFails(
      setDoc(doc(als(ANNA), 'support', 'sup-5'), anfrage(ANNA, { id: 'sup-5', text: 'x'.repeat(2001) })),
    )
  })

  it('lässt sich nicht als bereits erledigt einreichen', async () => {
    await assertFails(setDoc(doc(als(ANNA), 'support', 'sup-6'), anfrage(ANNA, { id: 'sup-6', status: 'erledigt' })))
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
