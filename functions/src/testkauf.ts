import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { logger } from 'firebase-functions'
import Stripe from 'stripe'
import { ABBRUCH_URL, ERFOLG_URL, TESTZAHLER, istTestschluessel } from './tarife.js'

/**
 * TESTKAUF – vorübergehend, auf Zuruf wieder entfernen.
 *
 * Ein günstiges Testprodukt im Live-Konto, damit die Verwaltung den echten
 * Zahlungsweg mit echtem Geld prüfen kann, ohne einen ganzen Tarif zu kaufen.
 * Es setzt keinen Tarif; der Eingang erscheint nur in #payments.
 *
 * Entfernen: diese Datei, ihren Export in index.ts, den Block „TESTKAUF" im
 * Webhook (index.ts), `starteTestkauf` in src/services/kasse.ts und
 * src/components/Testkauf.tsx samt Verwendung in src/routes/Preise.tsx.
 */

/** Preis im Live-Konto (price_… aus dem Stripe-Dashboard). */
export const TESTKAUF_PREIS = 'price_1UJ5ohBYL7YFNcX5hdnExUp1'
export const TESTKAUF_PLAN = 'testkauf'

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')

export const createTestkauf = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true, region: 'europe-west6' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Dafür musst du angemeldet sein.')
    if (!TESTZAHLER.includes(uid)) throw new HttpsError('permission-denied', 'Nur für die Verwaltung.')

    const schluessel = STRIPE_SECRET_KEY.value()
    if (istTestschluessel(schluessel)) {
      throw new HttpsError('failed-precondition', 'Das Testprodukt gibt es nur im Livebetrieb.')
    }

    try {
      const kasse = new Stripe(schluessel, { apiVersion: '2025-02-24.acacia' })
      // Einmalig oder wiederkehrend – so, wie das Produkt in Stripe angelegt ist.
      const preis = await kasse.prices.retrieve(TESTKAUF_PREIS)
      const sitzung = await kasse.checkout.sessions.create({
        mode: preis.type === 'recurring' ? 'subscription' : 'payment',
        line_items: [{ price: TESTKAUF_PREIS, quantity: 1 }],
        client_reference_id: uid,
        metadata: { uid, plan: TESTKAUF_PLAN },
        customer_email: request.auth?.token.email ?? undefined,
        success_url: ERFOLG_URL,
        cancel_url: ABBRUCH_URL,
        locale: 'de',
      })
      if (!sitzung.url) throw new HttpsError('internal', 'Stripe hat keine Adresse zurückgegeben.')
      return { url: sitzung.url }
    } catch (fehler) {
      if (fehler instanceof HttpsError) throw fehler
      logger.error('Testkauf fehlgeschlagen', { uid, fehler })
      // Nur die Verwaltung kommt hierher – der Grund von Stripe darf mit.
      throw new HttpsError('internal', `Stripe (Testkauf): ${fehler instanceof Error ? fehler.message : String(fehler)}`)
    }
  },
)
