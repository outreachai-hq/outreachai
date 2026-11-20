import { describe, it, expect } from 'vitest'
import { normalizeCompanyName, domainFromUrl } from '@/lib/normalizeCompany'

describe('normalizeCompanyName', () => {
  it('lowercases', () => {
    expect(normalizeCompanyName('Stripe')).toBe('stripe')
    expect(normalizeCompanyName('OPENAI')).toBe('openai')
  })

  it('strips Inc/Corp/LLC/Ltd suffixes (with or without dot)', () => {
    expect(normalizeCompanyName('Stripe Inc')).toBe('stripe')
    expect(normalizeCompanyName('Stripe Inc.')).toBe('stripe')
    expect(normalizeCompanyName('Stripe, Inc.')).toBe('stripe')
    expect(normalizeCompanyName('Acme Corp')).toBe('acme')
    expect(normalizeCompanyName('Acme Corp.')).toBe('acme')
    expect(normalizeCompanyName('Acme Co.')).toBe('acme')
    expect(normalizeCompanyName('Google LLC')).toBe('google')
    expect(normalizeCompanyName('Vodafone Ltd')).toBe('vodafone')
  })

  it('strips international suffixes (GmbH, AG, SAS, ...)', () => {
    expect(normalizeCompanyName('SAP GmbH')).toBe('sap')
    expect(normalizeCompanyName('Roche AG')).toBe('roche')
    expect(normalizeCompanyName('Mercedes Benz AG')).toBe('mercedes benz')
    expect(normalizeCompanyName('Lempire SAS')).toBe('lempire')
  })

  it('preserves multi-word names without obvious suffixes', () => {
    expect(normalizeCompanyName('Open AI')).toBe('open ai')
    expect(normalizeCompanyName('Goldman Sachs')).toBe('goldman sachs')
    expect(normalizeCompanyName('Y Combinator')).toBe('y combinator')
  })

  it('matches "Stripe" and "Stripe, Inc." to the same key', () => {
    expect(normalizeCompanyName('Stripe')).toBe(normalizeCompanyName('Stripe, Inc.'))
  })

  it('collapses internal whitespace', () => {
    expect(normalizeCompanyName('  Acme    Corp  ')).toBe('acme')
  })

  it('strips punctuation', () => {
    expect(normalizeCompanyName("L'Oréal".replace('é','e'))).toBe('loreal')
    expect(normalizeCompanyName("Macy's")).toBe('macys')
  })
})

describe('domainFromUrl', () => {
  it('extracts the hostname and strips www.', () => {
    expect(domainFromUrl('https://www.stripe.com/about')).toBe('stripe.com')
    expect(domainFromUrl('https://stripe.com')).toBe('stripe.com')
    expect(domainFromUrl('https://app.stripe.com')).toBe('app.stripe.com')
  })

  it('accepts schemeless URLs by prepending https', () => {
    expect(domainFromUrl('stripe.com')).toBe('stripe.com')
    expect(domainFromUrl('www.stripe.com')).toBe('stripe.com')
  })

  it('returns null on null/empty/invalid input', () => {
    expect(domainFromUrl(null)).toBeNull()
    expect(domainFromUrl(undefined)).toBeNull()
    expect(domainFromUrl('')).toBeNull()
    expect(domainFromUrl('not a url ::: ahhh')).toBeNull()
  })

  it('lowercases the hostname', () => {
    expect(domainFromUrl('HTTPS://STRIPE.COM/path')).toBe('stripe.com')
  })
})
