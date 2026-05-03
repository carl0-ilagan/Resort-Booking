/** Pure helpers shared by admin UI, PDF, print HTML, and send-invoice API */

export function calcNightsForInvoice(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  const inDate = String(checkIn).includes("T") ? new Date(checkIn) : new Date(String(checkIn) + "T00:00:00")
  const outDate = String(checkOut).includes("T") ? new Date(checkOut) : new Date(String(checkOut) + "T00:00:00")
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return 0
  inDate.setHours(0, 0, 0, 0)
  outDate.setHours(0, 0, 0, 0)
  const diff = outDate.getTime() - inDate.getTime()
  const nights = Math.ceil(diff / (1000 * 60 * 60 * 24))
  return nights > 0 ? nights : 1
}

export function formatDateForInvoice(dateString) {
  if (!dateString) return "—"
  try {
    const date = new Date(String(dateString).includes("T") ? dateString : String(dateString) + "T00:00:00")
    if (Number.isNaN(date.getTime())) return String(dateString)
    return date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
  } catch {
    return String(dateString)
  }
}

/** Same string as PDF + print invoice (`PHP 1,234.56`) — use everywhere invoice amounts appear. */
export function formatInvoiceAmountPhp(n) {
  const v = Number(n || 0)
  const s = v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `PHP ${s}`
}

export function getComputedTotalForInvoice(booking) {
  if (!booking) return 0
  if (booking.paidAmount != null && booking.paidAmount !== "") {
    const v = Number(booking.paidAmount)
    if (Number.isFinite(v)) return v
  }
  const nights = Number(booking.nights || 0) || calcNightsForInvoice(booking.checkIn, booking.checkOut)
  const ppn = Number(booking.pricePerNight || 0) || 0
  return nights > 0 && ppn > 0 ? ppn * nights : Number(booking.paidAmount) || 0
}

export const invoiceComputeHelpers = {
  calcNights: calcNightsForInvoice,
  formatDate: formatDateForInvoice,
  getComputedTotal: getComputedTotalForInvoice,
}
