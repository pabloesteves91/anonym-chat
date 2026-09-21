import { describe, expect, it } from 'vitest'
import { maskPhone, normalizePhone } from './shared'

describe('normalizePhone', () => {
  it('macht aus einer Schweizer Nummer die internationale Form', () => {
    expect(normalizePhone('079 123 45 67')).toBe('+41791234567')
    expect(normalizePhone('079-123-45-67')).toBe('+41791234567')
  })

  it('lässt eine bereits internationale Nummer stehen', () => {
    expect(normalizePhone('+49 170 1234567')).toBe('+491701234567')
  })

  it('weist ab, was keine Nummer ist', () => {
    expect(normalizePhone('0791234')).toBeNull()
    expect(normalizePhone('hallo')).toBeNull()
    expect(normalizePhone('')).toBeNull()
  })
})

describe('maskPhone', () => {
  it('zeigt nur Anfang und Ende', () => {
    const maskiert = maskPhone('+41791234567')
    expect(maskiert).toContain('+41')
    expect(maskiert).toContain('67')
    expect(maskiert).not.toContain('1234')
  })
})
