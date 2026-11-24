// Resident Profile data layer: Demographics, Admission, Diagnoses, Allergies,
// Providers, Vital Signs, and Primary Contacts for a single resident. All
// seven forms and field ids confirmed live against Jen's Sandbox this session
// (see .claude/specs/resident-profile/requirements.md). Follows the exact
// pattern established by lib/rooms.ts/lib/billing.ts: one `formEntries` query
// per form, rows filtered client-side by `record.baseEntry.topId`, parsed via
// `getField`/`extractTextFromHtml` from lib/formData.ts.
//
// Privacy: the `clientInfo` form also has a sensitive identifier field that is
// deliberately never fetched here (see requirements.md's Out of scope). Do
// not add it.

import { gql } from './gql.ts'
import { DEMO_UNIT_ID, resolveResidentRecordTopIds } from './rooms.ts'
import { getField, extractTextFromHtml, parseIntOrNull, getOptionText } from './formData.ts'
import type { FormEntryDataItem } from './formData.ts'

const CLIENT_INFO_FORM_ID = '1000001__FID_clientInfo'
const ADMISSIONS_FORM_ID = '1000001__FID_admissions'
const DIAGNOSES_FORM_ID = '1000001__FID_diagnoses'
const ALLERGIES_FORM_ID = '1000001__FID_allergies'
const PROVIDERS_FORM_ID = '1000001__FID_providers'
const VITAL_SIGNS_FORM_ID = '1000001__FID_vitalSigns'
const PRI_CONTACTS_FORM_ID = '1000001__FID_priContacts'

// Demographics (clientInfo) — single-entry per resident. The sensitive
// identifier field noted above is intentionally excluded.
const LABEL_GENDER = 'Gender'
const LABEL_BIRTH_DATE = 'Birth Date'
const LABEL_RELIGION = 'Religion'
const LABEL_MARITAL_STATUS = 'Marital Status'
const LABEL_HOSPITAL = 'Hospital'

const CLIENT_INFO_FIELD_IDS = [
  '1000101__GID_2820159', // Gender
  '1000101__SID_PERSONALINFO-BIRTHDATE', // Birth Date
  '1000101__GID_186505', // Religion
  '1000101__GID_186500', // Marital Status
  '1000101__GID_190718', // Hospital
]

// Admission (multi-entry)
const LABEL_ADMISSION_DATE_TIME = 'Date/Time'
const LABEL_ADMISSION_TYPE = 'Admission Type'

const ADMISSIONS_FIELD_IDS = [
  '1000101__GID_2203211', // Date/Time
  '1000101__GID_2203232', // Admission Type
]

// Diagnoses (multi-entry)
const LABEL_PRIMARY_DIAGNOSIS = 'Primary Diagnosis'
const LABEL_DIAGNOSIS = 'Diagnosis'
const LABEL_DIAGNOSIS_START = 'Start'
// The actual field label on this form is "End (Display & Edit)", not plain "End".
const LABEL_DIAGNOSIS_END = 'End (Display & Edit)'

const DIAGNOSES_FIELD_IDS = [
  '1000101___3753749', // Primary Diagnosis
  '1000101___2627739', // Diagnosis
  '1000101___2565303', // Start
  '1000101__GID_2565345', // End (Display & Edit)
]

// Allergies (multi-entry)
const LABEL_ALLERGY_TYPE = 'Allergy Type'
const LABEL_ALLERGY_NAME = 'Allergy Name'
const LABEL_ALLERGY_ONSET_DATE = 'Onset Date'
const LABEL_ALLERGY_SEVERITY = 'Severity'

const ALLERGIES_FIELD_IDS = [
  '1000101___2785382', // Allergy Type
  '1000101__GID_2785386', // Allergy Name
  '1000101__GID_2785387', // Onset Date
  '1000101__GID_2785388', // Severity
]

// Providers (multi-entry)
// "Provider (Relationship)" is a RELATIONSHIP field like Room's "Resident/s
// in room" — read its display text via extractTextFromHtml(valueAsString),
// never plain valueAsString.
const LABEL_PROVIDER = 'Provider (Relationship)'
const LABEL_PROVIDER_ROLE = 'Role'

const PROVIDERS_FIELD_IDS = [
  '1000101__GID_2195489', // Provider (Relationship)
  '1000101___2195490', // Role
]

// Vital Signs (multi-entry)
const LABEL_VITAL_DATE_TIME_TAKEN = 'Date/Time Taken'
const LABEL_VITAL_BLOOD_PRESSURE = 'Blood Pressure'
const LABEL_VITAL_RESPIRATORY_RATE = 'Respiratory Rate'
const LABEL_VITAL_HEART_RATE = 'Heart Rate'
const LABEL_VITAL_TEMPERATURE = 'Temperature'
const LABEL_VITAL_WEIGHT = 'Weight'
const LABEL_VITAL_GLUCOSE = 'Glucose'
const LABEL_VITAL_O2_SATS = 'O2 Sats'

const VITAL_SIGNS_FIELD_IDS = [
  '1000101__GID_222702', // Date/Time Taken
  '1000101__GID_222704', // Blood Pressure
  '1000101___233158', // Respiratory Rate
  '1000101___222705', // Heart Rate
  '1000101___222706', // Temperature
  '1000101___222703', // Weight
  '1000101___222707', // Glucose
  '1000101___233159', // O2 Sats
]

// Primary Contacts (multi-entry)
const LABEL_CONTACT_ORDER = 'Contact Order'
const LABEL_CONTACT_FULL_NAME = 'Full Name'
const LABEL_CONTACT_HOME_PHONE = 'Home Phone'
const LABEL_CONTACT_CELL_PHONE = 'Cell Phone'
const LABEL_CONTACT_WORK_PHONE = 'Work Phone'
const LABEL_CONTACT_RELATIONSHIP = 'Relationship to Resident'
const LABEL_CONTACT_TYPE = 'Type of Contact'
const LABEL_CONTACT_EMAIL = 'E-mail'

const PRI_CONTACTS_FIELD_IDS = [
  '1000101___2193049', // Contact Order
  '1000101___186484', // Full Name
  '1000101___186485', // Home Phone
  '1000101___190672', // Cell Phone
  '1000101___190671', // Work Phone
  '1000101___2820666', // Relationship to Resident
  '1000101___190666', // Type of Contact
  '1000101___190713', // E-mail
]

// Identical shape to billing.ts's CHARGES_QUERY — reused as the single query
// document for every form below, parameterized by formId/fields per call.
const PROFILE_FORM_QUERY = `
  query($formId: String!, $unitId: String, $fields: [String!]) {
    formEntries(formId: $formId, unitId: $unitId, count: 100) {
      rows {
        formEntry {
          record { baseEntry { topId } }
          data(fields: $fields) { name value valueAsString }
        }
      }
    }
  }
`

interface ProfileRow {
  formEntry: {
    record: { baseEntry: { topId: string } }
    data: FormEntryDataItem[]
  }
}

interface ProfileQueryResponse {
  formEntries: {
    rows: ProfileRow[]
  }
}

export interface Demographics {
  gender: string | null
  birthDate: string | null
  religion: string | null
  maritalStatus: string | null
  hospital: string | null
}

export interface AdmissionEntry {
  dateTime: string
  admissionType: string | null
}

export interface DiagnosisEntry {
  primaryDiagnosis: string | null
  diagnosis: string | null
  start: string | null
  end: string | null
}

export interface AllergyEntry {
  allergyType: string | null
  allergyName: string | null
  onsetDate: string | null
  severity: string | null
}

export interface ProviderEntry {
  provider: string | null
  role: string | null
}

export interface VitalSignsEntry {
  dateTimeTaken: string
  bloodPressure: string | null
  respiratoryRate: string | null
  heartRate: string | null
  temperature: string | null
  weight: string | null
  glucose: string | null
  o2Sats: string | null
}

export interface ContactEntry {
  contactOrder: number | null
  fullName: string | null
  homePhone: string | null
  cellPhone: string | null
  workPhone: string | null
  relationship: string | null
  contactType: string | null
  email: string | null
}

export interface ResidentProfile {
  demographics: Demographics | null
  admissions: AdmissionEntry[]
  diagnoses: DiagnosisEntry[]
  allergies: AllergyEntry[]
  providers: ProviderEntry[]
  vitalSigns: VitalSignsEntry[]
  contacts: ContactEntry[]
}

function parseDemographics(row: ProfileRow): Demographics {
  const data = row.formEntry.data
  return {
    gender: getOptionText(getField(data, LABEL_GENDER)),
    birthDate: getOptionText(getField(data, LABEL_BIRTH_DATE)),
    religion: getOptionText(getField(data, LABEL_RELIGION)),
    maritalStatus: getOptionText(getField(data, LABEL_MARITAL_STATUS)),
    hospital: getOptionText(getField(data, LABEL_HOSPITAL)),
  }
}

function parseAdmission(row: ProfileRow): AdmissionEntry {
  const data = row.formEntry.data
  return {
    dateTime: getField(data, LABEL_ADMISSION_DATE_TIME)?.valueAsString ?? '',
    admissionType: getOptionText(getField(data, LABEL_ADMISSION_TYPE)),
  }
}

function parseDiagnosis(row: ProfileRow): DiagnosisEntry {
  const data = row.formEntry.data
  return {
    primaryDiagnosis: getOptionText(getField(data, LABEL_PRIMARY_DIAGNOSIS)),
    diagnosis: getOptionText(getField(data, LABEL_DIAGNOSIS)),
    start: getOptionText(getField(data, LABEL_DIAGNOSIS_START)),
    end: getOptionText(getField(data, LABEL_DIAGNOSIS_END)),
  }
}

function parseAllergy(row: ProfileRow): AllergyEntry {
  const data = row.formEntry.data
  return {
    allergyType: getOptionText(getField(data, LABEL_ALLERGY_TYPE)),
    allergyName: getOptionText(getField(data, LABEL_ALLERGY_NAME)),
    onsetDate: getOptionText(getField(data, LABEL_ALLERGY_ONSET_DATE)),
    severity: getOptionText(getField(data, LABEL_ALLERGY_SEVERITY)),
  }
}

function parseProvider(row: ProfileRow): ProviderEntry {
  const data = row.formEntry.data
  const providerField = getField(data, LABEL_PROVIDER)
  return {
    provider: extractTextFromHtml(providerField?.valueAsString)[0] ?? null,
    role: getOptionText(getField(data, LABEL_PROVIDER_ROLE)),
  }
}

function parseVitalSigns(row: ProfileRow): VitalSignsEntry {
  const data = row.formEntry.data
  return {
    dateTimeTaken: getField(data, LABEL_VITAL_DATE_TIME_TAKEN)?.valueAsString ?? '',
    bloodPressure: getOptionText(getField(data, LABEL_VITAL_BLOOD_PRESSURE)),
    respiratoryRate: getOptionText(getField(data, LABEL_VITAL_RESPIRATORY_RATE)),
    heartRate: getOptionText(getField(data, LABEL_VITAL_HEART_RATE)),
    temperature: getOptionText(getField(data, LABEL_VITAL_TEMPERATURE)),
    weight: getOptionText(getField(data, LABEL_VITAL_WEIGHT)),
    glucose: getOptionText(getField(data, LABEL_VITAL_GLUCOSE)),
    o2Sats: getOptionText(getField(data, LABEL_VITAL_O2_SATS)),
  }
}

function parseContact(row: ProfileRow): ContactEntry {
  const data = row.formEntry.data
  const contactOrderField = getField(data, LABEL_CONTACT_ORDER)
  // `value` is the raw NUMBER when present; fall back to parsing the
  // formatted valueAsString if `value` isn't usable.
  const contactOrder = parseIntOrNull(contactOrderField?.value) ?? parseIntOrNull(contactOrderField?.valueAsString)

  return {
    contactOrder,
    fullName: getOptionText(getField(data, LABEL_CONTACT_FULL_NAME)),
    homePhone: getOptionText(getField(data, LABEL_CONTACT_HOME_PHONE)),
    cellPhone: getOptionText(getField(data, LABEL_CONTACT_CELL_PHONE)),
    workPhone: getOptionText(getField(data, LABEL_CONTACT_WORK_PHONE)),
    relationship: getOptionText(getField(data, LABEL_CONTACT_RELATIONSHIP)),
    contactType: getOptionText(getField(data, LABEL_CONTACT_TYPE)),
    email: getOptionText(getField(data, LABEL_CONTACT_EMAIL)),
  }
}

function rowsForResident(data: ProfileQueryResponse, residentTopId: string): ProfileRow[] {
  return data.formEntries.rows.filter((row) => row.formEntry.record.baseEntry.topId === residentTopId)
}

/**
 * Sorts Vital Signs descending by Date/Time Taken so the most recent reading
 * is index 0. Uses a real date compare when every entry's `dateTimeTaken`
 * parses as a valid Date; otherwise falls back to reverse-array-order (see
 * this task's summary for the flag to a human reviewer if that fallback is
 * ever hit).
 */
function sortVitalSignsDescending(entries: VitalSignsEntry[]): VitalSignsEntry[] {
  const allParseable = entries.every((entry) => !Number.isNaN(Date.parse(entry.dateTimeTaken)))
  if (allParseable) {
    return [...entries].sort((a, b) => Date.parse(b.dateTimeTaken) - Date.parse(a.dateTimeTaken))
  }
  return [...entries].reverse()
}

/** Sorts Contacts ascending by Contact Order, with null orders sorted last. */
function sortContactsAscending(entries: ContactEntry[]): ContactEntry[] {
  return [...entries].sort((a, b) => {
    if (a.contactOrder === null && b.contactOrder === null) return 0
    if (a.contactOrder === null) return 1
    if (b.contactOrder === null) return -1
    return a.contactOrder - b.contactOrder
  })
}

/**
 * Fetches a single resident's full profile (Demographics, Admission,
 * Diagnoses, Allergies, Providers, Vital Signs, Primary Contacts).
 *
 * `residentTopId` arrives as the raw "Individual Worksheet" row id (the same
 * id `Residents.tsx`/`ResidentRecord.tsx` route by, and `Room.residentTopIds`
 * already uses) — NOT the id these seven forms' `record.baseEntry.topId`
 * actually match against. Exactly like `billing.ts`'s `buildResidentBillings`,
 * it must be resolved first via `resolveResidentRecordTopIds` before it can be
 * compared against any row here; comparing the raw worksheet id directly
 * (as an earlier version of this file did) silently matches zero rows for
 * every resident. Confirmed live this session against Jen's Sandbox: the
 * resolved id is the same one `billing.ts` already resolves to, so this reuses
 * that existing resolver rather than duplicating the lookup.
 */
export async function fetchResidentProfile(residentTopId: string): Promise<ResidentProfile> {
  const resolvedMap = await resolveResidentRecordTopIds([residentTopId])
  const resolvedId = resolvedMap.get(residentTopId) ?? residentTopId

  const [clientInfoData, admissionsData, diagnosesData, allergiesData, providersData, vitalSignsData, contactsData] =
    await Promise.all([
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: CLIENT_INFO_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: CLIENT_INFO_FIELD_IDS,
      }),
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: ADMISSIONS_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: ADMISSIONS_FIELD_IDS,
      }),
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: DIAGNOSES_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: DIAGNOSES_FIELD_IDS,
      }),
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: ALLERGIES_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: ALLERGIES_FIELD_IDS,
      }),
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: PROVIDERS_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: PROVIDERS_FIELD_IDS,
      }),
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: VITAL_SIGNS_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: VITAL_SIGNS_FIELD_IDS,
      }),
      gql<ProfileQueryResponse>(PROFILE_FORM_QUERY, {
        formId: PRI_CONTACTS_FORM_ID,
        unitId: DEMO_UNIT_ID,
        fields: PRI_CONTACTS_FIELD_IDS,
      }),
    ])

  const clientInfoRow = rowsForResident(clientInfoData, resolvedId)[0]

  return {
    demographics: clientInfoRow ? parseDemographics(clientInfoRow) : null,
    admissions: rowsForResident(admissionsData, resolvedId).map(parseAdmission),
    diagnoses: rowsForResident(diagnosesData, resolvedId).map(parseDiagnosis),
    allergies: rowsForResident(allergiesData, resolvedId).map(parseAllergy),
    providers: rowsForResident(providersData, resolvedId).map(parseProvider),
    vitalSigns: sortVitalSignsDescending(rowsForResident(vitalSignsData, resolvedId).map(parseVitalSigns)),
    contacts: sortContactsAscending(rowsForResident(contactsData, resolvedId).map(parseContact)),
  }
}
