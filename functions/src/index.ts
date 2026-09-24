import { initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { defineSecret } from 'firebase-functions/params'
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2/options'
import { logger } from 'firebase-functions'
import Stripe from 'stripe'
import { ABBRUCH_URL, ERFOLG_URL, TARIFE, TESTZAHLER, darfBezahlen, istEingerichtet, istTestschluessel, istPlanId, type PlanId } from './tarife.js'
import { gutschein, rabattFuer } from './aktion.js'
import { DISCORD_WEBHOOK_PAYMENTS, aboEndeEintrag, zahlungEintrag, zahlungMelden } from './zahlungen.js'

/**
 * Die Kasse.
 *
 * Es gibt genau einen Grund, warum das hier läuft und nicht im Browser: Ein
 * Browser darf über einen bezahlten Zugang nicht selbst entscheiden. Die
 * Quittung muss von etwas geprüft werden, das die zahlende Person nicht
 * kontrolliert – und das ist diese Funktion.
 *
 * Sie schreibt mit dem Admin-SDK und geht damit an den Security Rules
 * vorbei. Das ist beabsichtigt und der Grund, weshalb die Rules
 * `users.membership` für alle ausser der Verwaltung sperren dürfen.
 *
 * Die beiden Schlüssel liegen im Secret Manager, nie im Repository:
 *   firebase functions:secrets:set STRIPE_SECRET_KEY
 *   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
 */

initializeApp()

// Zürich: kurze Wege zur Datenbank in eur3 und zur Kundschaft.
setGlobalOptions({ region: 'europe-west6', maxInstances: 10 })

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY')
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET')

const db = () => getFirestore()

function stripe(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: '2025-02-24.acacia' })
}

/* ------------------------------------------------------- Zahlung starten */

/**
 * Eröffnet eine Checkout-Sitzung und gibt die Adresse zurück.
 *
 * Der Browser schickt nur die Tarifkennung – welcher Preis dahintersteht,
 * entscheidet der Server. Sonst könnte jemand den Lifetime-Zugang zum
 * Monatspreis buchen.
 */
export const createCheckoutSession = onCall(
  { secrets: [STRIPE_SECRET_KEY], cors: true },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Dafür musst du angemeldet sein.')
    // Testbetrieb: nur die Verwaltung – sonst gäbe es Plus für eine Testkarte.
    if (!darfBezahlen(STRIPE_SECRET_KEY.value(), uid)) {
      throw new HttpsError('permission-denied', 'Die Kasse ist noch im Testbetrieb.')
    }

    const plan = (request.data ?? {}).plan as unknown
    if (!istPlanId(plan)) throw new HttpsError('invalid-argument', 'Diesen Tarif gibt es nicht.')
    if (!istEingerichtet(plan)) {
      // Lieber ein klarer Fehler als eine Zahlung, die nirgends ankommt.
      throw new HttpsError('failed-precondition', 'Die Kasse ist noch nicht eingerichtet.')
    }

    const tarif = TARIFE[plan]
    const abo = tarif.art === 'abo'

    try {
      const kasse = stripe()
      // Aktionen: der beste laufende Rabatt für diesen Tarif, samt Gutschein.
      const rabatt = await rabattFuer(plan, (request.data ?? {}).code)
      const sitzung = await kasse.checkout.sessions.create({
        mode: abo ? 'subscription' : 'payment',
        line_items: [{ price: tarif.priceId, quantity: 1 }],
        ...(rabatt ? { discounts: [{ coupon: await gutschein(kasse, rabatt) }] } : {}),
        // Beide Wege zurück: die Kennung als Referenz und in den Metadaten.
        client_reference_id: uid,
        metadata: { uid, plan },
        ...(abo ? { subscription_data: { metadata: { uid, plan } } } : {}),
        customer_email: request.auth?.token.email ?? undefined,
        success_url: ERFOLG_URL,
        cancel_url: ABBRUCH_URL,
        locale: 'de',
      })

      if (!sitzung.url) throw new HttpsError('internal', 'Stripe hat keine Adresse zurückgegeben.')
      return { url: sitzung.url }
    } catch (fehler) {
      if (fehler instanceof HttpsError) throw fehler
      logger.error('Checkout-Sitzung fehlgeschlagen', { uid, plan, fehler })
      // Im Testbetrieb (nur die Verwaltung kommt bis hier) die Antwort von
      // Stripe mitgeben – sonst sucht man den Grund in den Logs.
      const grund = fehler instanceof Error ? fehler.message : String(fehler)
      throw new HttpsError(
        'internal',
        istTestschluessel(STRIPE_SECRET_KEY.value())
          ? `Stripe (Testmodus): ${grund}`
          : 'Die Zahlung konnte nicht gestartet werden.',
      )
    }
  },
)

/* ------------------------------------------------------ Quittung prüfen */

/** Laufzeit eines Abos in Millisekunden, grosszügig gerechnet. */
/**
 * Wann die bezahlte Periode endet.
 *
 * Je nach API-Version steht das am Abo selbst (bis 2025-02) oder an seiner
 * Position (neuere Versionen) – Stripe schickt Ereignisse in der Version,
 * die beim Webhook eingestellt ist. Beide Orte werden gelesen.
 */
function periodeEnde(abo: Stripe.Subscription): number | null {
  const a = abo as unknown as {
    current_period_end?: number
    items?: { data?: { current_period_end?: number }[] }
  }
  return a.current_period_end ?? a.items?.data?.[0]?.current_period_end ?? null
}

function bisAus(sekunden: number | null | undefined): string | null {
  if (!sekunden) return null
  return new Date(sekunden * 1000).toISOString()
}

async function setzeTarif(uid: string, plan: PlanId, bis: string | null): Promise<void> {
  await db()
    .collection('users')
    .doc(uid)
    .set(
      {
        membership: { plan, seit: new Date().toISOString(), bis },
        // Für das Protokoll: kein Mensch, sondern die Kasse.
        geaendertVon: 'kasse',
      },
      { merge: true },
    )

  // Ein offener Wunsch ist damit erfüllt.
  await db()
    .collection('planRequests')
    .doc(uid)
    .set({ erledigt: true }, { merge: true })
    .catch(() => undefined)

  logger.info('Tarif gesetzt', { uid, plan, bis })
}

async function zurueckAufGratis(uid: string): Promise<void> {
  await db()
    .collection('users')
    .doc(uid)
    .set(
      { membership: { plan: 'frei', seit: new Date().toISOString(), bis: null }, geaendertVon: 'kasse' },
      { merge: true },
    )
  logger.info('Tarif beendet', { uid })
}

/**
 * Hat dieses Ereignis schon einmal gewirkt?
 *
 * Stripe stellt im Zweifel mehrfach zu. Ohne diese Sperre könnte eine
 * doppelte Zustellung eine Laufzeit verlängern, die niemand bezahlt hat.
 */
async function schonVerarbeitet(id: string): Promise<boolean> {
  const ref = db().collection('stripeEvents').doc(id)
  try {
    await ref.create({ at: FieldValue.serverTimestamp() })
    return false
  } catch {
    return true
  }
}

function uidAus(objekt: { metadata?: Stripe.Metadata | null; client_reference_id?: string | null }): string | null {
  return objekt.metadata?.uid ?? objekt.client_reference_id ?? null
}

function planAus(objekt: { metadata?: Stripe.Metadata | null }): PlanId | null {
  const plan = objekt.metadata?.plan
  return istPlanId(plan) ? plan : null
}

/**
 * Nimmt die Meldungen von Stripe entgegen.
 *
 * Geprüft wird die Signatur, nicht der Inhalt: Ohne sie könnte jede Person,
 * die die Adresse kennt, sich selbst einen Lifetime-Zugang schicken.
 */
export const stripeWebhook = onRequest(
  { secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DISCORD_WEBHOOK_PAYMENTS] },
  async (request, response) => {
    const signatur = request.headers['stripe-signature']
    if (typeof signatur !== 'string') {
      response.status(400).send('Signatur fehlt.')
      return
    }

    let ereignis: Stripe.Event
    try {
      ereignis = stripe().webhooks.constructEvent(request.rawBody, signatur, STRIPE_WEBHOOK_SECRET.value())
    } catch (fehler) {
      logger.warn('Signatur abgelehnt', { fehler })
      response.status(400).send('Signatur stimmt nicht.')
      return
    }

    if (await schonVerarbeitet(ereignis.id)) {
      response.status(200).send('Schon verarbeitet.')
      return
    }

    try {
      switch (ereignis.type) {
        case 'checkout.session.completed': {
          const sitzung = ereignis.data.object
          // Bei Rechnung oder Vorkasse ist erst später bezahlt.
          if (sitzung.payment_status !== 'paid' && sitzung.status !== 'complete') break
          const uid = uidAus(sitzung)
          const plan = planAus(sitzung)
          if (!uid || !plan) {
            logger.error('Sitzung ohne Kennung', { id: sitzung.id })
            break
          }
          // Doppelt gesichert: Aus dem Testmodus gibt es nur für die
          // Verwaltung einen Tarif, egal wie die Sitzung zustande kam.
          if (!ereignis.livemode && !TESTZAHLER.includes(uid)) {
            logger.warn('Testzahlung eines anderen Kontos ignoriert', { id: sitzung.id })
            break
          }
          let bis: string | null = null
          if (sitzung.mode === 'subscription' && typeof sitzung.subscription === 'string') {
            const abo = await stripe().subscriptions.retrieve(sitzung.subscription)
            bis = bisAus(periodeEnde(abo))
          }
          // Lifetime läuft nicht ab (bis = null).
          await setzeTarif(uid, plan, bis)
          await zahlungMelden(
            zahlungEintrag({
              uid,
              plan,
              rappen: sitzung.amount_total,
              waehrung: sitzung.currency,
              bis,
              test: !ereignis.livemode,
            }),
          )
          break
        }

        case 'customer.subscription.updated': {
          const abo = ereignis.data.object
          const uid = uidAus(abo)
          const plan = planAus(abo)
          if (!uid || !plan) break
          if (!ereignis.livemode && !TESTZAHLER.includes(uid)) break
          const laeuft = abo.status === 'active' || abo.status === 'trialing'
          if (laeuft) await setzeTarif(uid, plan, bisAus(periodeEnde(abo)))
          else await zurueckAufGratis(uid)
          break
        }

        case 'customer.subscription.deleted': {
          const uid = uidAus(ereignis.data.object)
          if (uid) {
            await zurueckAufGratis(uid)
            await zahlungMelden(aboEndeEintrag({ uid, test: !ereignis.livemode }))
          }
          break
        }

        default:
          // Alles andere interessiert uns nicht – bestätigen und gut.
          break
      }
      response.status(200).send('Angenommen.')
    } catch (fehler) {
      logger.error('Ereignis konnte nicht verarbeitet werden', { id: ereignis.id, fehler })
      // Die Sperre wieder lösen, damit Stripe es erneut zustellen kann.
      await db().collection('stripeEvents').doc(ereignis.id).delete().catch(() => undefined)
      response.status(500).send('Fehler beim Verarbeiten.')
    }
  },
)

/* ------------------------------------------------------------ Discord */

export { meldungNachDiscord, supportNachDiscord, supportAntwortNachDiscord, supportErledigtAufraeumen } from './discord.js'
export { feedbackAuswerten, gespraechGezaehlt, gespraechVerfallen } from './gespraeche.js'
export { supportfallProtokoll, meldungProtokoll, kontoProtokoll, aktionProtokoll, neuigkeitProtokoll } from './protokoll.js'
