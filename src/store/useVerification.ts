import { create } from 'zustand'
import * as api from '../services/api'
import { ImageError, createPreview, type Preview } from '../services/image'
import { useSession } from './useSession'
import type { VerificationRequest, VerifyStep } from '../services/types'

/**
 * Der Verifizierungsantrag: Mobilnummer per SMS bestätigen, Ausweisfoto und
 * Selfie hochladen, absenden. Freigeben kann danach nur ein Mensch – dieser
 * Store wartet darauf, er entscheidet nichts.
 *
 * Die SMS ist echt und kommt von Firebase. Die Nummer wird dabei fest mit dem
 * Konto verbunden; dieselbe Nummer lässt sich kein zweites Mal verwenden.
 */

interface VerificationState {
  step: VerifyStep
  phoneInput: string
  /** Bestätigte Nummer in Normalform. */
  phone: string | null
  codeInput: string
  /** Eine SMS ist unterwegs, der Code wird erwartet. */
  codeUnterwegs: boolean
  ausweis: Preview | null
  selfie: Preview | null
  request: VerificationRequest | null
  busy: boolean
  error: string | null
  hinweis: string | null

  setPhoneInput: (value: string) => void
  setCodeInput: (value: string) => void
  goTo: (step: VerifyStep) => void
  sendCode: () => Promise<void>
  confirmCode: () => Promise<void>
  pickImage: (kind: 'ausweis' | 'selfie', file: File | null) => Promise<void>
  submit: () => Promise<boolean>
  loadRequest: () => Promise<void>
  startOver: () => Promise<void>
  reset: () => void
}

const fehlertext = (error: unknown, fallback: string) =>
  error instanceof api.ApiError || error instanceof ImageError ? error.message : fallback

const LEER = {
  step: 'telefon' as VerifyStep,
  phoneInput: '',
  phone: null,
  codeInput: '',
  codeUnterwegs: false,
  ausweis: null,
  selfie: null,
  busy: false,
  error: null,
  hinweis: null,
}

export const useVerification = create<VerificationState>((set, get) => ({
  ...LEER,
  request: null,

  setPhoneInput(value) {
    set({ phoneInput: value, error: null })
  },

  setCodeInput(value) {
    set({ codeInput: value.replace(/\D/g, '').slice(0, 6), error: null })
  },

  goTo(step) {
    set({ step, error: null })
  },

  async sendCode() {
    set({ busy: true, error: null, hinweis: null })
    try {
      const { phone, bereitsBestaetigt } = await api.requestSmsCode(get().phoneInput)
      if (bereitsBestaetigt) {
        // Die Nummer hängt schon am Konto – eine zweite SMS wäre sinnlos.
        set({
          phone,
          busy: false,
          codeUnterwegs: false,
          step: 'ausweis',
          hinweis: 'Diese Nummer ist bereits bestätigt.',
        })
        return
      }
      set({ phone, codeInput: '', codeUnterwegs: true, step: 'code', busy: false })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Die SMS konnte nicht verschickt werden.') })
    }
  },

  async confirmCode() {
    set({ busy: true, error: null })
    try {
      await api.confirmSmsCode(get().codeInput)
      set({ codeUnterwegs: false, step: 'ausweis', busy: false })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Der Code konnte nicht geprüft werden.') })
    }
  },

  async pickImage(kind, file) {
    if (!file) return
    set({ busy: true, error: null })
    try {
      const preview = await createPreview(file)
      set(kind === 'ausweis' ? { ausweis: preview, busy: false } : { selfie: preview, busy: false })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Das Foto konnte nicht verarbeitet werden.') })
    }
  },

  async submit() {
    const { phone, ausweis, selfie } = get()
    if (!phone || !ausweis || !selfie) {
      set({ error: 'Es fehlt noch die Nummer, das Ausweisfoto oder das Selfie.' })
      return false
    }
    set({ busy: true, error: null })
    try {
      const request = await api.submitVerification({ phone, ausweis, selfie })
      // Bilder aus dem Formular fallen lassen – sie liegen jetzt beim Antrag.
      set({ request, ausweis: null, selfie: null, busy: false })
      await useSession.getState().refreshUser()
      return true
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Der Antrag konnte nicht eingereicht werden.') })
      return false
    }
  },

  async loadRequest() {
    set({ request: await api.getMyVerification() })
  },

  async startOver() {
    set({ busy: true })
    try {
      await api.withdrawVerification()
      await useSession.getState().refreshUser()
      set({ ...LEER, request: null })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Der Antrag konnte nicht zurückgezogen werden.') })
    }
  },

  reset() {
    set({ ...LEER, request: null })
  },
}))
