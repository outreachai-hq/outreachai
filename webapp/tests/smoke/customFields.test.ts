// Plan 5 (Iter 1) — helpers for custom-field validation, coercion, prompt rendering.

import { describe, it, expect } from 'vitest'
import {
  validateKey, slugifyKey, coerceValue, renderPrompt,
} from '@/lib/customFields'

describe('validateKey', () => {
  it('accepts a lowercase snake_case key', () => {
    expect(validateKey('decision_maker_score', 'lead')).toBeNull()
  })
  it('rejects keys starting with a digit', () => {
    expect(validateKey('1score', 'lead')).toMatch(/key must match/)
  })
  it('rejects keys with uppercase or special chars', () => {
    expect(validateKey('DecisionScore', 'lead')).toMatch(/key must match/)
    expect(validateKey('decision-maker', 'lead')).toMatch(/key must match/)
  })
  it('blocks collision with native lead field (lowercase keys only — native uppercase keys already fail the pattern)', () => {
    // 'firstname' (no uppercase) is allowed — collision check is exact-match;
    // 'firstName' is rejected by the pattern, not the collision check.
    expect(validateKey('firstname', 'lead')).toBeNull()
    expect(validateKey('company', 'lead')).toMatch(/collides/)
    expect(validateKey('email', 'lead')).toMatch(/collides/)
  })
  it('blocks collision with native company field', () => {
    expect(validateKey('industry', 'company')).toMatch(/collides/)
  })
})

describe('slugifyKey', () => {
  it('lowercases + underscores + strips edges', () => {
    expect(slugifyKey('Decision-maker Score!')).toBe('decision_maker_score')
  })
  it('caps at 31 chars', () => {
    expect(slugifyKey('a'.repeat(50)).length).toBe(31)
  })
})

describe('coerceValue', () => {
  it('coerces numeric strings', () => {
    expect(coerceValue('number', '42')).toBe(42)
    expect(coerceValue('number', 'NaN')).toBeNull()
  })
  it('coerces boolean from string', () => {
    expect(coerceValue('bool', 'true')).toBe(true)
    expect(coerceValue('bool', 'false')).toBe(false)
    expect(coerceValue('bool', 'yes')).toBe(true)
  })
  it('coerces date to ISO string', () => {
    expect(coerceValue('date', '2026-12-25')).toMatch(/^2026-12-25T/)
  })
  it('multiselect always returns an array', () => {
    expect(coerceValue('multiselect', 'one')).toEqual(['one'])
    expect(coerceValue('multiselect', ['one', 'two'])).toEqual(['one', 'two'])
  })
  it('passes null through', () => {
    expect(coerceValue('text', null)).toBeNull()
  })
})

describe('renderPrompt', () => {
  it('substitutes known field names', () => {
    const out = renderPrompt('Hi {{firstName}} at {{company}}', { firstName: 'Aakash', company: 'PhonePe' })
    expect(out).toBe('Hi Aakash at PhonePe')
  })
  it('coerces missing fields to empty string', () => {
    const out = renderPrompt('Hi {{firstName}} ({{notARealField}})', { firstName: 'Sara' })
    expect(out).toBe('Hi Sara ({{notARealField}})') // unknown placeholders pass through
  })
  it('handles all-empty row gracefully', () => {
    const out = renderPrompt('Greet {{firstName}}.', {})
    expect(out).toBe('Greet .')
  })
})
