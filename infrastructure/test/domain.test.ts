import {
  InputError,
  parseCampaignInput,
  parseCampaignPatch,
  parseDonationInput,
} from '../lib/domain'

const donation = {
  idempotencyKey: '2a45f57f-3286-4d24-876a-53ed34ec5220',
  campaignId: 'campaign-123',
  amountInCents: 2500,
  isPublic: false,
}

describe('parseDonationInput', () => {
  test('accepts a donation with the supported fields only', () => {
    expect(parseDonationInput(donation)).toEqual(donation)
  })

  test.each([99, 500001, 1000.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid amount %s',
    (amountInCents) => {
      expect(() =>
        parseDonationInput({ ...donation, amountInCents }),
      ).toThrow(InputError)
    },
  )

  test('rejects browser-supplied payment status', () => {
    expect(() =>
      parseDonationInput({
        ...donation,
        status: 'SIMULATED_SUCCESS',
      }),
    ).toThrow('unsupported fields')
  })

  test('requires explicit consent before accepting a public donor name', () => {
    expect(
      parseDonationInput({
        ...donation,
        isPublic: true,
        donorName: 'Ana',
      }),
    ).toMatchObject({ isPublic: true, donorName: 'Ana' })

    expect(() =>
      parseDonationInput({ ...donation, donorName: 'Ana' }),
    ).toThrow('must not be sent')
  })

  test('rejects public donations without a valid name', () => {
    expect(() =>
      parseDonationInput({ ...donation, isPublic: true, donorName: ' ' }),
    ).toThrow('Donor name is invalid')
  })

  test('requires a UUID v4 idempotency key', () => {
    expect(() =>
      parseDonationInput({ ...donation, idempotencyKey: 'not-a-uuid' }),
    ).toThrow('UUID v4')
  })
})

describe('campaign parsing', () => {
  const campaign = {
    organization: 'Asociación Ejemplo',
    title: 'Apoyo escolar',
    summary: 'Material educativo para la comunidad.',
    category: 'Educación',
    goalInCents: 100000,
  }

  test('accepts campaign fields and rejects client-controlled status', () => {
    expect(parseCampaignInput(campaign)).toEqual(campaign)
    expect(() =>
      parseCampaignInput({ ...campaign, status: 'ACTIVE' }),
    ).toThrow('unsupported fields')
  })

  test('accepts partial administrative updates', () => {
    expect(parseCampaignPatch({ title: 'Nuevo título', status: 'ACTIVE' })).toEqual({
      title: 'Nuevo título',
      status: 'ACTIVE',
    })
  })

  test('rejects archival through the generic update endpoint', () => {
    expect(() => parseCampaignPatch({ status: 'ARCHIVED' })).toThrow(
      'Campaign status is invalid',
    )
  })
})
