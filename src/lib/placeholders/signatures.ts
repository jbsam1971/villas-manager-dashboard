// Placeholder electronic-signature layer for the eMAR med-pass PIN sign-off
// flow.
//
// NOT real BlueStep data, and NOT a real auth backend. Per the user's spec,
// every Sign/Refused/Held/PRN action on the MAR must open a PIN sign-off
// step before it's saved, verified against the signed-in user, with the
// result stored as a dose event's electronic signature (name, credential,
// server time, signature id, device id, attestation version). There's no
// server here, so PIN "verification" below is a fixed demo PIN per staff
// member — when this is wired to real data, this whole module gets
// replaced by a server-verified PIN check (hashed, lockout, audit log all
// live on the server), and the shapes below are kept close to what that
// check will need to return.

export interface StaffMember {
  staffId: string
  fullName: string
  credential: string
  initials: string
  /** DEMO ONLY. A real backend verifies a hashed PIN server-side, never a plain value shipped to the client. */
  demoPin: string
}

export interface SignatureRecord {
  signatureId: string
  staffId: string
  fullName: string
  credential: string
  /** Display-formatted, e.g. "Nov 24, 2026 at 8:12 AM" — server clock, community time zone, once this is real. */
  signedAt: string
  method: 'PIN verified'
  deviceId: string
  attestationVersion: string
}

export const ATTESTATION_TEXT =
  'By entering my PIN I confirm I personally completed this action and that this entry is my electronic signature.'

export const ATTESTATION_VERSION = 'v1'

export const DEMO_DEVICE_ID = 'cart-2-hallb-tablet'

/** Every roster member's demo PIN — shown in the modal's own hint text so the sample is usable without a key. */
export const DEMO_PIN = '1234'

export const MAX_PIN_ATTEMPTS = 5

export function getStaffRoster(): StaffMember[] {
  return [
    { staffId: 'st-lm', fullName: 'Luis Martinez', credential: 'Med tech', initials: 'LM', demoPin: DEMO_PIN },
    { staffId: 'st-ar', fullName: 'Ana Ruiz', credential: 'Med tech', initials: 'AR', demoPin: DEMO_PIN },
    { staffId: 'st-kw', fullName: 'Keisha Williams', credential: 'LPN', initials: 'KW', demoPin: DEMO_PIN },
    { staffId: 'st-bo', fullName: 'Ben Okoro', credential: 'Med tech', initials: 'BO', demoPin: DEMO_PIN },
  ]
}

/** The cart's currently signed-in user — matches getEmarCartInfo().signedInAs ("Luis Martinez, Med tech"). */
export function getSignedInStaff(): StaffMember {
  return getStaffRoster()[0]
}

/** Staff available to witness a controlled-substance count, excluding whoever is signing primarily. */
export function getWitnessOptions(excludeStaffId: string): StaffMember[] {
  return getStaffRoster().filter((s) => s.staffId !== excludeStaffId)
}

/** DEMO verification only — see module header. */
export function verifyPin(staffId: string, pin: string): boolean {
  const staff = getStaffRoster().find((s) => s.staffId === staffId)
  return !!staff && pin === staff.demoPin
}

let signatureCounter = 100

export function nextSignatureId(): string {
  signatureCounter += 1
  return `ES-${String(signatureCounter).padStart(6, '0')}`
}

export function makeSignature(staff: StaffMember, signedAtDisplay: string): SignatureRecord {
  return {
    signatureId: nextSignatureId(),
    staffId: staff.staffId,
    fullName: staff.fullName,
    credential: staff.credential,
    signedAt: signedAtDisplay,
    method: 'PIN verified',
    deviceId: DEMO_DEVICE_ID,
    attestationVersion: ATTESTATION_VERSION,
  }
}
