import { create } from 'zustand'
import * as api from '../services/mockApi'
import { ImageError, createPreview, type Preview } from '../services/image'
import { useSession } from './useSession'
import type { VerificationRequest, VerifyStep } from '../services/types'

/**
 * Der Verifizierungsantrag: Mobilnummer bestätigen, Ausweisfoto und Selfie
 * hochladen, absenden. Freigeben kann danach nur ein Mensch – dieser Store
 * wartet darauf, er entscheidet nichts.
 */

interface VerificationState {
  step: VerifyStep
  phoneInput: string
  /** Bestätigte Nummer in Normalform. */
  phone: string | null
  /** Im Prototyp sichtbar, weil keine echte SMS rausgeht. */
  demoCode: string | null
  codeInput: string
  codeExpiresAt: number | null
  ausweis: Preview | null
  selfie: Preview | null
  request: VerificationRequest | null
  busy: boolean
  error: string | null

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

export const useVerification = create<VerificationState>((set, get) => ({
  step: 'telefon',
  phoneInput: '',
  phone: null,
  demoCode: null,
  codeInput: '',
  codeExpiresAt: null,
  ausweis: null,
  selfie: null,
  request: null,
  busy: false,
  error: null,

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
    set({ busy: true, error: null })
    try {
      const { phone, code, expiresAt } = await api.requestSmsCode(get().phoneInput)
      set({ phone, demoCode: code, codeExpiresAt: expiresAt, codeInput: '', step: 'code', busy: false })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Der Code konnte nicht gesendet werden.') })
    }
  },

  async confirmCode() {
    set({ busy: true, error: null })
    try {
      const phone = await api.confirmSmsCode(get().codeInput)
      set({ phone, demoCode: null, step: 'ausweis', busy: false })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Der Code konnte nicht geprüft werden.') })
    }
  },

  async pickImage(kind, file) {
    if (!file) return
    set({ busy: true, error: null })
    try {
      const preview = await createPreview(file)
      set({ [kind]: preview, busy: false } as Pick<VerificationState, 'ausweis' | 'selfie'> & { busy: boolean })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Das Foto konnte nicht verarbeitet werden.') })
    }
  },

  async submit() {
    const { phone, ausweis, selfie } = get()
    if (!phone || !ausweis || !selfie) {
      set({ error: 'Es fehlt noch etwas: Nummer, Ausweisfoto oder Selfie.' })
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
    await api.withdrawVerification()
    await useSession.getState().refreshUser()
    set({
      busy: false,
      request: null,
      step: 'telefon',
      phone: null,
      phoneInput: '',
      demoCode: null,
      codeInput: '',
      ausweis: null,
      selfie: null,
      error: null,
    })
  },

  reset() {
    set({
      step: 'telefon',
      phoneInput: '',
      phone: null,
      demoCode: null,
      codeInput: '',
      codeExpiresAt: null,
      ausweis: null,
      selfie: null,
      request: null,
      busy: false,
      error: null,
    })
  },
}))
