import { create } from 'zustand'
import * as api from '../services/api'
import { ImageError, createDemoPreview, createPreview, type Preview } from '../services/image'
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
  useDemoImage: (kind: 'ausweis' | 'selfie') => void
  submit: () => Promise<boolean>
  loadRequest: () => Promise<void>
  /** Nur für die Demo: eigenen Antrag ohne Moderation freigeben. */
  selfApprove: () => Promise<void>
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
      set(kind === 'ausweis' ? { ausweis: preview, busy: false } : { selfie: preview, busy: false })
    } catch (error) {
      set({ busy: false, error: fehlertext(error, 'Das Foto konnte nicht verarbeitet werden.') })
    }
  },

  useDemoImage(kind) {
    try {
      const preview = createDemoPreview(kind)
      set(kind === 'ausweis' ? { ausweis: preview, error: null } : { selfie: preview, error: null })
    } catch (error) {
      set({ error: fehlertext(error, 'Das Demo-Bild konnte nicht erzeugt werden.') })
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

  /**
   * Freigabe ohne Moderation.
   *
   * Existiert nur, solange alle Daten lokal im Browser der testenden Person
   * liegen – die Moderation sieht diese Anträge gar nicht. Sobald die Anträge
   * in Firestore stehen, entfällt dieser Weg ersatzlos.
   */
  async selfApprove() {
    const request = get().request
    if (!request) return
    set({ busy: true })
    try {
      await api.decideVerification(request.id, 'freigegeben')
      await useSession.getState().refreshUser()
      set({ busy: false, request: await api.getMyVerification() })
    } catch {
      set({ busy: false, error: 'Freigabe im Demo-Modus fehlgeschlagen.' })
    }
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
