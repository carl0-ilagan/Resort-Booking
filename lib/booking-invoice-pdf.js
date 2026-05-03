/**
 * PDF invoice — formatted layout aligned with print HTML (jsPDF).
 */

import { jsPDF } from "jspdf"
import { formatInvoiceAmountPhp } from "@/lib/booking-invoice-helpers"

function addWrapped(doc, text, x, y, maxW, lineHeight) {
  const lines = doc.splitTextToSize(String(text || ""), maxW)
  doc.text(lines, x, y)
  return y + lines.length * lineHeight
}

/** @param {Record<string, unknown>} opts */
export function downloadBookingInvoicePdf(opts) {
  const b = opts.booking || {}
  const biz = opts.business || {}
  const resortName = String(biz.name || "Resort").trim() || "Resort"

  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const m = 44
  const maxW = W - m * 2
  const colW = (maxW - 12) / 2

  doc.setFont("helvetica", "bold")
  doc.setFontSize(72)
  doc.setTextColor(240, 243, 242)
  const wm = resortName.length > 22 ? `${resortName.slice(0, 19)}…` : resortName
  doc.text(wm, W / 2, H / 2, { align: "center", angle: 32 })

  doc.setTextColor(15, 23, 42)
  doc.setFillColor(13, 148, 136)
  doc.rect(0, 0, W, 6, "F")

  let y = m
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(13, 148, 136)
  doc.text("INVOICE", m, y)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(16)
  doc.setTextColor(15, 23, 42)
  doc.text(`#${String(b.id || "").slice(0, 18)}`, m, y + 16)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`Issued ${opts.issuedLabel}`, W - m, y, { align: "right" })
  y += 38

  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(250, 250, 250)
  doc.roundedRect(m, y, colW, 78, 4, 4, "FD")
  doc.roundedRect(m + colW + 12, y, colW, 78, 4, 4, "FD")

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text("FROM", m + 12, y + 14)
  doc.text("BILL TO", m + colW + 24, y + 14)

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  let yL = y + 28
  doc.text(resortName, m + 12, yL, { maxWidth: colW - 20 })
  yL += 14
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  if (biz.address) yL = addWrapped(doc, biz.address, m + 12, yL, colW - 20, 11)
  if (biz.phone) {
    doc.text(String(biz.phone), m + 12, yL)
    yL += 12
  }
  if (biz.email) {
    doc.text(String(biz.email), m + 12, yL)
    yL += 12
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  let yR = y + 28
  doc.text(String(b.name || "Guest"), m + colW + 24, yR, { maxWidth: colW - 20 })
  yR += 14
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(String(b.email || "—"), m + colW + 24, yR, { maxWidth: colW - 20 })
  yR += 12
  if (b.phone) {
    doc.text(String(b.phone), m + colW + 24, yR, { maxWidth: colW - 20 })
    yR += 12
  }

  y = y + 88

  const rowLine = (label, value, yy) => {
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(148, 163, 184)
    doc.text(label, m, yy)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(15, 23, 42)
    const lines = doc.splitTextToSize(String(value ?? "—"), maxW - 120)
    doc.text(lines, m + 108, yy)
    return yy + Math.max(13, lines.length * 12)
  }

  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text("BOOKING", m, y)
  y += 14
  y = rowLine("Status", String(b.status || "Pending").trim(), y)
  y = rowLine("Payment", String(b.paymentStatus || "unpaid"), y)
  y += 10

  doc.text("STAY", m, y)
  y += 14
  y = rowLine("Room", b.roomType || "—", y)
  y = rowLine("Check-in", opts.formattedCheckIn, y)
  y = rowLine("Check-out", opts.formattedCheckOut, y)
  y = rowLine("Guests", String(b.guests ?? "—"), y)
  y += 8

  if (b.specialRequests) {
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(m, y, maxW, 36, 3, 3, "F")
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text("NOTE", m + 8, y + 12)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(71, 85, 105)
    addWrapped(doc, String(b.specialRequests), m + 8, y + 22, maxW - 16, 11)
    y += 44
  }

  const nights = Number(opts.nights) || 0
  const ppn = Number(opts.pricePerNight) || 0
  const grandTotal = Number(opts.grandTotal) || 0
  const singleLine = Boolean(opts.singleChargeLine)
  const lineTotal = Number(opts.lineTotal) || 0

  y += 6
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text("CHARGES", m, y)
  y += 14

  const t0 = m
  const t1 = m + maxW * 0.52
  const t2 = m + maxW * 0.68
  const t3 = m + maxW * 0.82
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(241, 245, 249)
  doc.rect(t0, y - 10, maxW, 18, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("DESCRIPTION", t0 + 4, y)
  doc.text("QTY", t1, y, { align: "center" })
  doc.text("UNIT", t2, y, { align: "right" })
  doc.text("AMOUNT", W - m - 4, y, { align: "right" })
  y += 16

  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(15, 23, 42)
  doc.line(m, y - 6, W - m, y - 6)

  if (singleLine) {
    const desc = String(opts.singleLineDescription || "Accommodation")
    doc.text(desc, t0 + 4, y, { maxWidth: maxW * 0.48 })
    doc.text("1", t1, y, { align: "center" })
    doc.text(formatInvoiceAmountPhp(grandTotal), t2, y, { align: "right" })
    doc.text(formatInvoiceAmountPhp(grandTotal), W - m - 4, y, { align: "right" })
    y += 18
  } else {
    doc.text(`${String(b.roomType || "Room")} — stay`, t0 + 4, y, { maxWidth: maxW * 0.48 })
    doc.text(String(nights), t1, y, { align: "center" })
    doc.text(formatInvoiceAmountPhp(ppn), t2, y, { align: "right" })
    doc.text(formatInvoiceAmountPhp(lineTotal), W - m - 4, y, { align: "right" })
    y += 18
  }

  doc.setDrawColor(13, 148, 136)
  doc.setLineWidth(0.8)
  doc.line(m, y + 4, W - m, y + 4)
  y += 18
  doc.setFont("helvetica", "bold")
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text("Total due", t0 + 4, y)
  doc.text(formatInvoiceAmountPhp(grandTotal), W - m - 4, y, { align: "right" })
  y += 28

  doc.setFont("helvetica", "normal")
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  addWrapped(
    doc,
    "Thank you for your booking. For official receipts, follow your accountant’s guidance.",
    m,
    y,
    maxW,
    11,
  )

  const safeId = String(b.id || "booking")
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .slice(0, 48)
  doc.save(`invoice-${safeId}.pdf`)
}
