import { create } from 'zustand'
import * as api from '../services/api'
import { alleGesehen, type Neuigkeit } from '../services/neuigkeiten'
import { KEYS, readJson, writeJson } from '../services/storage'

/**
 * Veröffentlichte Neuigkeiten, live – und was dieses Gerät schon gesehen hat.
 *
 * Gesehen ist gerätebezogen (localStorage), nicht kontobezogen: Der Punkt
 * am Menüpunkt soll auch ohne Anmeldung funktionieren. Geht der Speicher
 * nicht, gilt eben alles als neu – schadet nicht.
 */
interface NeuigkeitenState {
  liste: Neuigkeit[]
  bereit: boolean
  gesehen: string[]
  beobachte: () => () => void
  /** Alles Veröffentlichte als gesehen markieren – beim Öffnen der Seite. */
  allesGesehen: () => void
}

export const useNeuigkeiten = create<NeuigkeitenState>((set, get) => ({
  liste: [],
  bereit: false,
  gesehen: readJson<string[]>(KEYS.neuigkeitenGesehen, []),

  beobachte() {
    return api.watchNeuigkeiten((liste) => set({ liste, bereit: true }))
  },

  allesGesehen() {
    const { liste, gesehen } = get()
    const neu = alleGesehen(liste, gesehen)
    if (neu.length === gesehen.length && neu.every((id, i) => id === gesehen[i])) return
    writeJson(KEYS.neuigkeitenGesehen, neu)
    set({ gesehen: neu })
  },
}))
