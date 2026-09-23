import { describe, expect, it } from 'vitest'
import indexDatei from '../../firestore.indexes.json'

/**
 * Die Index-Konfiguration – geprüft an der Datei selbst.
 *
 * Warum eine Prüfung auf eine Konfigurationsdatei: Der Firestore-Emulator
 * kennt keine Indizes. Er beantwortet jede Abfrage, ob ein Index existiert
 * oder nicht. Ein fehlender Index ist deshalb in jedem Emulatortest
 * unsichtbar und fällt erst in Betrieb auf.
 *
 * Genau so ist es passiert: Für `chats.expiresAt` war die Indexierung mit
 * `"indexes": []` abgeschaltet – eine übliche Empfehlung für Felder mit
 * TTL-Richtlinie. Die Moderation fragt die Verläufe aber mit einem
 * Zeitbereich und einer Sortierung genau über dieses Feld ab
 * (`listTranscripts` in `backend/firestore.ts`). In Betrieb lehnte Firestore
 * das ab, und die Moderation stand leer, während jeder Test grün war.
 */

interface Override {
  collectionGroup: string
  fieldPath: string
  ttl?: boolean
  indexes: { order?: string; arrayConfig?: string; queryScope: string }[]
}

const konfiguration = indexDatei as { fieldOverrides: Override[] }

const override = (sammlung: string, feld: string) =>
  konfiguration.fieldOverrides.find((o) => o.collectionGroup === sammlung && o.fieldPath === feld)

describe('firestore.indexes.json', () => {
  it('hält die Verläufe abfragbar: chats.expiresAt hat beide Indizes', () => {
    const chats = override('chats', 'expiresAt')
    expect(chats, 'Ohne Eintrag gilt die Standardindexierung – dann fehlt aber die TTL').toBeDefined()
    expect(chats?.ttl, 'Die 72-Stunden-Löschung hängt an dieser Richtlinie').toBe(true)

    const reihenfolgen = chats?.indexes.filter((i) => i.queryScope === 'COLLECTION').map((i) => i.order)
    // Absteigend für `orderBy('expiresAt', 'desc')`, aufsteigend für den
    // Bereichsfilter – ohne beide lehnt Firestore die Abfrage ab.
    expect(reihenfolgen).toContain('DESCENDING')
    expect(reihenfolgen).toContain('ASCENDING')
  })

  it('lässt messages.expiresAt bewusst ohne Index', () => {
    // Hier ist die Abschaltung richtig: viele Schreibvorgänge, keine Abfrage
    // auf das Feld. Ein Index kostete nur. Wer hier einen einführt, braucht
    // eine Abfrage, die ihn rechtfertigt.
    const nachrichten = override('messages', 'expiresAt')
    expect(nachrichten?.ttl).toBe(true)
    expect(nachrichten?.indexes).toEqual([])
  })
})
