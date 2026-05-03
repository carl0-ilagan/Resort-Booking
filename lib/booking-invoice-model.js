/**
 * Shared fields for invoice HTML print + PDF export.
 */

/**
 * @param {Record<string, unknown>} booking
 * @param {Record<string, unknown> | null} invoiceBusiness
 * @param {{
 *   calcNights: (checkIn: unknown, checkOut: unknown) => number
 *   formatDate: (d: unknown) => string
 *   getComputedTotal: (b: Record<string, unknown>) => number
 * }} helpers
 */
export function computeBookingInvoiceOpts(booking, invoiceBusiness, helpers) {
  const { calcNights, formatDate, getComputedTotal } = helpers
  const biz = invoiceBusiness || {}
  const nights = Number(booking.nights || 0) || calcNights(booking.checkIn, booking.checkOut)
  const ppn = Number(booking.pricePerNight || 0) || 0
  const grandTotal = getComputedTotal(booking)
  const rawLine = ppn > 0 && nights > 0 ? ppn * nights : 0
  const useSingle = !(ppn > 0 && nights > 0) || Math.abs(rawLine - grandTotal) > 0.05

  return {
    booking,
    business: {
      name: String(biz.name || "").trim(),
      address: String(biz.address || "").trim(),
      phone: String(biz.phone || "").trim(),
      email: String(biz.email || "").trim(),
    },
    nights,
    pricePerNight: ppn,
    lineTotal: useSingle ? grandTotal : rawLine,
    grandTotal,
    formattedCheckIn: formatDate(booking.checkIn),
    formattedCheckOut: formatDate(booking.checkOut),
    issuedLabel: new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" }),
    singleChargeLine: useSingle,
    singleLineDescription: `${booking.roomType || "Room"} — booking`,
  }
}
