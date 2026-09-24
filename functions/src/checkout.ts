import type Stripe from 'stripe'

/**
 * Eine Checkout-Sitzung anlegen – auch in einem Konto mit Managed Payments.
 *
 * Wir verkaufen selbst, ohne Managed Payments (Stripe als Händler). Ist es
 * im Stripe-Konto trotzdem eingeschaltet, lehnt Stripe unsere API-Version
 * ab. Dann wird es für diese eine Sitzung ausdrücklich abgeschaltet – mit
 * einer API-Version, die den Parameter kennt. Konten ohne Managed Payments
 * (etwa die Sandbox) bleiben beim ersten, gewöhnlichen Versuch.
 */
export const VERSION_MIT_MANAGED_PAYMENTS = '2026-04-22.dahlia'

export const istManagedPaymentsFehler = (fehler: unknown) =>
  fehler instanceof Error && fehler.message.includes('Managed Payments')

export async function sitzungErstellen(
  kasse: Stripe,
  parameter: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  try {
    return await kasse.checkout.sessions.create(parameter)
  } catch (fehler) {
    if (!istManagedPaymentsFehler(fehler)) throw fehler
    const ohneManagedPayments = { ...parameter, managed_payments: { enabled: false } }
    return await kasse.checkout.sessions.create(ohneManagedPayments as Stripe.Checkout.SessionCreateParams, {
      apiVersion: VERSION_MIT_MANAGED_PAYMENTS,
    })
  }
}
