import { describe, expect, it, vi } from 'vitest'
import { VERSION_MIT_MANAGED_PAYMENTS, sitzungErstellen } from './checkout'

const parameter = { mode: 'payment', line_items: [{ price: 'price_x', quantity: 1 }] } as never

function kasseMit(create: ReturnType<typeof vi.fn>) {
  return { checkout: { sessions: { create } } } as never
}

describe('Checkout ohne Managed Payments', () => {
  it('bleibt beim gewöhnlichen Aufruf, wenn Stripe ihn annimmt', async () => {
    const create = vi.fn().mockResolvedValue({ url: 'https://checkout' })
    await sitzungErstellen(kasseMit(create), parameter)
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]).toEqual([parameter])
  })

  it('schaltet Managed Payments nur ab, wenn Stripe es verlangt', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('Managed Payments is not supported on API version 2025-02-24.acacia.'))
      .mockResolvedValueOnce({ url: 'https://checkout' })
    const sitzung = await sitzungErstellen(kasseMit(create), parameter)
    expect(sitzung.url).toBe('https://checkout')
    expect(create.mock.calls[1][0]).toMatchObject({ managed_payments: { enabled: false } })
    expect(create.mock.calls[1][1]).toEqual({ apiVersion: VERSION_MIT_MANAGED_PAYMENTS })
  })

  it('reicht andere Fehler unverändert weiter', async () => {
    const create = vi.fn().mockRejectedValue(new Error('No such price'))
    await expect(sitzungErstellen(kasseMit(create), parameter)).rejects.toThrow('No such price')
    expect(create).toHaveBeenCalledTimes(1)
  })
})
