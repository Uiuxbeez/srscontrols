/** SRS Controls' own registered GST state code (Tamil Nadu) — the first 2 digits of any GSTIN. */
export const HOME_STATE_CODE = "33"

/** True when the client's GSTIN state-code prefix differs from SRS Controls' own — i.e. an
 * inter-state supply, which must be taxed as IGST instead of CGST+SGST. Clients without a
 * GSTIN on file default to intra-state (CGST+SGST), matching prior behavior. */
export function isInterState(clientGstin: string | null | undefined): boolean {
  if (!clientGstin || clientGstin.trim().length < 2) return false
  return clientGstin.trim().slice(0, 2) !== HOME_STATE_CODE
}
