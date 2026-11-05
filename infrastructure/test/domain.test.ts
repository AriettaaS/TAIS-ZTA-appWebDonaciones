import {
  InputError,
  parseCampaignInput,
  parseCampaignPatch,
  parseDonationInput,
  MAX_DONATION_CENTS,
  MIN_DONATION_CENTS,
  MAX_CAMPAIGN_AMOUNT_CENTS,
} from '../lib/domain'

describe('parseDonationInput', () => {
  const validDonation = {
    idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    campaignId: 'campaign-123',
    amountInCents: 2500,
    isPublic: false,
  }

  // Test 1: Donacion valida se procesa correctamente
  test('acepta donacion valida', () => {
    expect(parseDonationInput(validDonation)).toEqual(validDonation)
  })

  // Test 2: UUID v4 se convierte a minusculas
  test('convierte idempotencyKey a minusculas', () => {
    const upper = '550E8400-E29B-41D4-A716-446655440000'
    const result = parseDonationInput({ ...validDonation, idempotencyKey: upper })
    expect(result.idempotencyKey).toBe(upper.toLowerCase())
  })

  // Test 3: Monto minimo 100 centavos se acepta
  test('acepta monto minimo 100 centavos', () => {
    expect(parseDonationInput({...validDonation, amountInCents: 100})).toHaveProperty('amountInCents', 100)
  })

  // Test 4: Monto maximo 500000 centavos se acepta
  test('acepta monto maximo 500000 centavos', () => {
    expect(parseDonationInput({...validDonation, amountInCents: 500000})).toHaveProperty('amountInCents', 500000)
  })

  // Test 5: UUID v1 es rechazado
  test('rechaza UUID v1', () => {
    expect(() => parseDonationInput({...validDonation, idempotencyKey: '550e8400-e29b-11d4-a716-446655440000'})).toThrow('UUID v4')
  })

  // Test 6: Monto 99 centavos rechazado
  test('rechaza monto 99 centavos', () => {
    expect(() => parseDonationInput({...validDonation, amountInCents: 99})).toThrow('Donation amount')
  })

  // Test 7: Monto 500001 centavos rechazado
  test('rechaza monto 500001 centavos', () => {
    expect(() => parseDonationInput({...validDonation, amountInCents: 500001})).toThrow('Donation amount')
  })

  // Test 8: Monto con decimales rechazado
  test('rechaza monto con decimales', () => {
    expect(() => parseDonationInput({...validDonation, amountInCents: 1000.5})).toThrow('Donation amount')
  })

  // Test 9: Sin idempotencyKey rechazado
  test('rechaza sin idempotencyKey', () => {
    const {idempotencyKey, ...incomplete} = validDonation
    expect(() => parseDonationInput(incomplete)).toThrow(InputError)
  })

  // Test 10: Sin campaignId rechazado
  test('rechaza sin campaignId', () => {
    const {campaignId, ...incomplete} = validDonation
    expect(() => parseDonationInput(incomplete)).toThrow(InputError)
  })

  // Test 11: Sin amountInCents rechazado
  test('rechaza sin amountInCents', () => {
    const {amountInCents, ...incomplete} = validDonation
    expect(() => parseDonationInput(incomplete)).toThrow(InputError)
  })

  // Test 12: Sin isPublic rechazado
  test('rechaza sin isPublic', () => {
    const {isPublic, ...incomplete} = validDonation
    expect(() => parseDonationInput(incomplete)).toThrow(InputError)
  })

  // Test 13: Donacion publica sin donorName rechazada
  test('rechaza donacion publica sin donorName', () => {
    expect(() => parseDonationInput({...validDonation, isPublic: true})).toThrow(InputError)
  })

  // Test 14: Donacion publica con nombre valido aceptada
  test('acepta donacion publica con nombre', () => {
    const result = parseDonationInput({...validDonation, isPublic: true, donorName: 'Juan'})
    expect(result.donorName).toBe('Juan')
  })

  // Test 15: Nombre 81 caracteres rechazado
  test('rechaza nombre 81 caracteres', () => {
    const long = 'A'.repeat(81)
    expect(() => parseDonationInput({...validDonation, isPublic: true, donorName: long})).toThrow('Donor name')
  })

  // Test 16: Nombre en donacion privada rechazado
  test('rechaza nombre en donacion privada', () => {
    expect(() => parseDonationInput({...validDonation, donorName: 'Juan'})).toThrow('must not be sent')
  })

  // Test 17: Campo extra rechazado
  test('rechaza campo extra', () => {
    expect(() => parseDonationInput({...validDonation, extra: 'no'})).toThrow('unsupported fields')
  })

  // Test 18: Payload null rechazado
  test('rechaza payload null', () => {
    expect(() => parseDonationInput(null)).toThrow('Request body must be an object')
  })
})

describe('parseCampaignInput', () => {
  const campaign = {
    organization: 'Fundacion',
    title: 'Campana',
    summary: 'Resumen',
    category: 'Educacion',
    goalInCents: 100000,
  }

  // Test 19: Campana valida aceptada
  test('acepta campana valida', () => {
    expect(parseCampaignInput(campaign)).toEqual(campaign)
  })

  // Test 20: GoalInCents minimo 100 aceptado
  test('acepta goalInCents 100', () => {
    expect(parseCampaignInput({...campaign, goalInCents: 100})).toHaveProperty('goalInCents', 100)
  })

  // Test 21: GoalInCents maximo 100000000 aceptado
  test('acepta goalInCents 100000000', () => {
    expect(parseCampaignInput({...campaign, goalInCents: 100000000})).toHaveProperty('goalInCents', 100000000)
  })

  // Test 22: GoalInCents 99 rechazado
  test('rechaza goalInCents 99', () => {
    expect(() => parseCampaignInput({...campaign, goalInCents: 99})).toThrow('Campaign goal')
  })

  // Test 23: GoalInCents 100000001 rechazado
  test('rechaza goalInCents 100000001', () => {
    expect(() => parseCampaignInput({...campaign, goalInCents: 100000001})).toThrow('Campaign goal')
  })

  // Test 24: Organizacion 120 caracteres aceptada
  test('acepta organizacion 120 caracteres', () => {
    const org = 'A'.repeat(120)
    expect(parseCampaignInput({...campaign, organization: org})).toHaveProperty('organization', org)
  })

  // Test 25: Organizacion 121 caracteres rechazada
  test('rechaza organizacion 121 caracteres', () => {
    const org = 'A'.repeat(121)
    expect(() => parseCampaignInput({...campaign, organization: org})).toThrow('Organization')
  })

  // Test 26: Titulo vacio rechazado
  test('rechaza titulo vacio', () => {
    expect(() => parseCampaignInput({...campaign, title: '   '})).toThrow('Campaign title')
  })

  // Test 27: Sin organizacion rechazado
  test('rechaza sin organizacion', () => {
    const {organization, ...incomplete} = campaign
    expect(() => parseCampaignInput(incomplete)).toThrow(InputError)
  })

  // Test 28: Sin titulo rechazado
  test('rechaza sin titulo', () => {
    const {title, ...incomplete} = campaign
    expect(() => parseCampaignInput(incomplete)).toThrow(InputError)
  })

  // Test 29: Sin resumen rechazado
  test('rechaza sin resumen', () => {
    const {summary, ...incomplete} = campaign
    expect(() => parseCampaignInput(incomplete)).toThrow(InputError)
  })

  // Test 30: Sin categoria rechazado
  test('rechaza sin categoria', () => {
    const {category, ...incomplete} = campaign
    expect(() => parseCampaignInput(incomplete)).toThrow(InputError)
  })

  // Test 31: Sin goalInCents rechazado
  test('rechaza sin goalInCents', () => {
    const {goalInCents, ...incomplete} = campaign
    expect(() => parseCampaignInput(incomplete)).toThrow(InputError)
  })

  // Test 32: Status controlado por cliente rechazado
  test('rechaza status controlado por cliente', () => {
    expect(() => parseCampaignInput({...campaign, status: 'ACTIVE'})).toThrow('unsupported fields')
  })

  // Test 33: Campo extra rechazado
  test('rechaza campo extra', () => {
    expect(() => parseCampaignInput({...campaign, extra: 'no'})).toThrow('unsupported fields')
  })

  // Test 34: Payload null rechazado
  test('rechaza payload null', () => {
    expect(() => parseCampaignInput(null)).toThrow('Request body must be an object')
  })
})

describe('parseCampaignPatch', () => {
  // Test 35: Actualizacion titulo aceptada
  test('acepta actualizacion titulo', () => {
    const patch = {title: 'Nuevo'}
    expect(parseCampaignPatch(patch)).toEqual(patch)
  })

  // Test 36: Status ACTIVE en patch aceptado
  test('acepta status ACTIVE', () => {
    const patch = {status: 'ACTIVE'}
    expect(parseCampaignPatch(patch)).toEqual(patch)
  })

  // Test 37: Status DRAFT en patch aceptado
  test('acepta status DRAFT', () => {
    const patch = {status: 'DRAFT'}
    expect(parseCampaignPatch(patch)).toEqual(patch)
  })

  // Test 38: Patch vacio rechazado
  test('rechaza patch vacio', () => {
    expect(() => parseCampaignPatch({})).toThrow(InputError)
  })

  // Test 39: Titulo vacio en patch rechazado
  test('rechaza titulo vacio en patch', () => {
    expect(() => parseCampaignPatch({title: '   '})).toThrow('Campaign title')
  })

  // Test 40: GoalInCents 99 en patch rechazado
  test('rechaza goalInCents 99 en patch', () => {
    expect(() => parseCampaignPatch({goalInCents: 99})).toThrow('Campaign goal')
  })

  // Test 41: GoalInCents 100000001 en patch rechazado
  test('rechaza goalInCents 100000001 en patch', () => {
    expect(() => parseCampaignPatch({goalInCents: 100000001})).toThrow('Campaign goal')
  })

  // Test 42: Status ARCHIVED rechazado
  test('rechaza status ARCHIVED', () => {
    expect(() => parseCampaignPatch({status: 'ARCHIVED'})).toThrow('Campaign status')
  })

  // Test 43: CreatedAt rechazado
  test('rechaza createdAt', () => {
    expect(() => parseCampaignPatch({title: 'Nuevo', createdAt: '2024'})).toThrow('unsupported fields')
  })

  // Test 44: UpdatedAt rechazado
  test('rechaza updatedAt', () => {
    expect(() => parseCampaignPatch({title: 'Nuevo', updatedAt: '2024'})).toThrow('unsupported fields')
  })

  // Test 45: Actualizacion multiple aceptada
  test('acepta actualizacion multiple', () => {
    const patch = {title: 'Nuevo', goalInCents: 500000}
    expect(parseCampaignPatch(patch)).toEqual(patch)
  })

  // Test 46: Payload null rechazado
  test('rechaza payload null', () => {
    expect(() => parseCampaignPatch(null)).toThrow('Request body must be an object')
  })
})
