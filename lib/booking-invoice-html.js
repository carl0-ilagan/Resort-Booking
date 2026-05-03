/**
 * Printable invoice HTML + email-safe fragment for guests.
 * PDF: booking-invoice-pdf.js — keep amounts + footer copy aligned with PDF.
 */

import { formatInvoiceAmountPhp } from "@/lib/booking-invoice-helpers"

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/**
 * Shared body — `email` uses inline styles only (clients strip classes).
 */
function buildInvoiceBodyHtml(opts, email) {
  const b = opts.booking || {}
  const biz = opts.business || {}
  const resortName = String(biz.name || "Resort").trim() || "Resort"

  const bookingId = String(b.id || "—")
  const bookingIdDisplay = String(b.id || "").slice(0, 18)
  const guestName = String(b.name || "—")
  const guestEmail = String(b.email || "—")
  const guestPhone = String(b.phone || "—")
  const roomType = String(b.roomType || "—")
  const status = String(b.status || "Pending").trim() || "Pending"
  const payStatus = String(b.paymentStatus || "unpaid")
  const special = b.specialRequests ? String(b.specialRequests) : ""

  const nights = Number(opts.nights) || 0
  const ppn = Number(opts.pricePerNight) || 0
  const lineTotal = Number(opts.lineTotal) || 0
  const grandTotal = Number(opts.grandTotal) || 0
  const singleLine = Boolean(opts.singleChargeLine)

  const th = email
    ? "padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:11px;font-weight:600;color:#64748b;text-align:left;text-transform:uppercase;letter-spacing:0.05em;"
    : "padding:10px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;"
  const td = email
    ? "padding:10px 12px;border:1px solid #e2e8f0;font-size:14px;color:#0f172a;vertical-align:top;"
    : "padding:10px 12px;border:1px solid #e2e8f0;font-size:14px;color:#0f172a;vertical-align:top;"

  const chargeRow = singleLine
    ? `<tr>
        <td style="${td}">${escapeHtml(opts.singleLineDescription || "Accommodation")}</td>
        <td style="${td}text-align:center;width:64px">1</td>
        <td style="${td}text-align:right;font-variant-numeric:tabular-nums;width:100px">${formatInvoiceAmountPhp(grandTotal)}</td>
        <td style="${td}text-align:right;font-variant-numeric:tabular-nums;font-weight:600;width:100px">${formatInvoiceAmountPhp(grandTotal)}</td>
      </tr>`
    : `<tr>
        <td style="${td}">${escapeHtml(roomType)} <span style="color:#64748b;font-size:12px">— stay</span></td>
        <td style="${td}text-align:center;width:64px">${nights}</td>
        <td style="${td}text-align:right;font-variant-numeric:tabular-nums;width:100px">${formatInvoiceAmountPhp(ppn)}</td>
        <td style="${td}text-align:right;font-variant-numeric:tabular-nums;font-weight:500;width:100px">${formatInvoiceAmountPhp(lineTotal)}</td>
      </tr>`

  const card = email
    ? (label, lines, rightCol) => `
    <td style="width:50%;vertical-align:top;padding:${rightCol ? "0 0 0 10px" : "0 10px 0 0"};">
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px 18px;background:#fafafa;">
        <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">${label}</p>
        ${lines}
      </div>
    </td>`
    : () => ""

  const fromLines = [
    `<p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#0f172a;">${escapeHtml(resortName)}</p>`,
    biz.address ? `<p style="margin:0;font-size:13px;color:#475569;line-height:1.5;">${escapeHtml(biz.address)}</p>` : "",
    biz.phone ? `<p style="margin:6px 0 0;font-size:13px;color:#475569;">${escapeHtml(biz.phone)}</p>` : "",
    biz.email ? `<p style="margin:4px 0 0;font-size:13px;color:#475569;">${escapeHtml(biz.email)}</p>` : "",
  ]
    .filter(Boolean)
    .join("")

  const toLines = [
    `<p style="margin:0 0 4px;font-weight:700;font-size:15px;color:#0f172a;">${escapeHtml(guestName)}</p>`,
    `<p style="margin:0;font-size:13px;color:#475569;">${escapeHtml(guestEmail)}</p>`,
    guestPhone && guestPhone !== "—"
      ? `<p style="margin:6px 0 0;font-size:13px;color:#475569;">${escapeHtml(guestPhone)}</p>`
      : "",
  ]
    .filter(Boolean)
    .join("")

  const metaBlock = email
    ? `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
  <tr>
    <td style="vertical-align:top;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.12em;color:#0d9488;text-transform:uppercase;">Invoice</p>
      <p style="margin:0;font-family:ui-monospace,monospace;font-size:15px;font-weight:700;color:#0f172a;">#${escapeHtml(bookingId.slice(0, 12))}${bookingId.length > 12 ? "…" : ""}</p>
    </td>
    <td style="vertical-align:top;text-align:right;">
      <p style="margin:0 0 4px;font-size:12px;color:#64748b;">Issued</p>
      <p style="margin:0;font-size:14px;font-weight:500;color:#0f172a;">${escapeHtml(opts.issuedLabel)}</p>
    </td>
  </tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:24px;">
  <tr>
    ${card("From", fromLines, false)}
    ${card("Bill to", toLines, true)}
  </tr>
</table>`
    : `
<div class="inv-top">
  <div>
    <p class="inv-kicker">Invoice</p>
    <p class="inv-number">#<span class="inv-mono">${escapeHtml(bookingIdDisplay || "—")}</span></p>
  </div>
  <div class="inv-issued">
    <p class="inv-issued-l">Issued</p>
    <p class="inv-issued-v">${escapeHtml(opts.issuedLabel)}</p>
  </div>
</div>
<div class="inv-bill-grid">
  <div class="inv-card">
    <p class="inv-card-label">From</p>
    <p class="inv-strong">${escapeHtml(resortName)}</p>
    ${biz.address ? `<p class="inv-muted">${escapeHtml(biz.address)}</p>` : ""}
    ${biz.phone ? `<p class="inv-muted" style="margin-top:6px">${escapeHtml(biz.phone)}</p>` : ""}
    ${biz.email ? `<p class="inv-muted" style="margin-top:4px">${escapeHtml(biz.email)}</p>` : ""}
  </div>
  <div class="inv-card">
    <p class="inv-card-label">Bill to</p>
    <p class="inv-strong">${escapeHtml(guestName)}</p>
    <p class="inv-muted">${escapeHtml(guestEmail)}</p>
    ${guestPhone && guestPhone !== "—" ? `<p class="inv-muted" style="margin-top:6px">${escapeHtml(guestPhone)}</p>` : ""}
  </div>
</div>`

  const detailsTable = email
    ? `
<p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Booking</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
  <tr><td style="${th}width:32%">Status</td><td style="${td}">${escapeHtml(status)}</td></tr>
  <tr><td style="${th}">Payment</td><td style="${td}">${escapeHtml(payStatus)}</td></tr>
</table>
<p style="margin:0 0 8px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Stay</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin-bottom:20px;">
  <tr><td style="${th}width:32%">Room</td><td style="${td}">${escapeHtml(roomType)}</td></tr>
  <tr><td style="${th}">Check-in</td><td style="${td}">${escapeHtml(opts.formattedCheckIn)}</td></tr>
  <tr><td style="${th}">Check-out</td><td style="${td}">${escapeHtml(opts.formattedCheckOut)}</td></tr>
  <tr><td style="${th}">Guests</td><td style="${td}">${escapeHtml(String(b.guests ?? "—"))}</td></tr>
</table>`
    : `
<h2 class="inv-h2">Booking</h2>
<table class="inv-tbl">
  <tr><td class="inv-th" style="width:32%">Status</td><td class="inv-td">${escapeHtml(status)}</td></tr>
  <tr><td class="inv-th">Payment</td><td class="inv-td">${escapeHtml(payStatus)}</td></tr>
</table>
<h2 class="inv-h2">Stay</h2>
<table class="inv-tbl">
  <tr><td class="inv-th" style="width:32%">Room</td><td class="inv-td">${escapeHtml(roomType)}</td></tr>
  <tr><td class="inv-th">Check-in</td><td class="inv-td">${escapeHtml(opts.formattedCheckIn)}</td></tr>
  <tr><td class="inv-th">Check-out</td><td class="inv-td">${escapeHtml(opts.formattedCheckOut)}</td></tr>
  <tr><td class="inv-th">Guests</td><td class="inv-td">${escapeHtml(String(b.guests ?? "—"))}</td></tr>
</table>`

  const noteBlock =
    special &&
    (email
      ? `<div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #0d9488;border-radius:0 8px 8px 0;">
           <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Note</p>
           <p style="margin:0;font-size:13px;color:#475569;line-height:1.55;">${escapeHtml(special)}</p>
         </div>`
      : `<div class="inv-note"><p class="inv-note-h">Note</p><p class="inv-note-p">${escapeHtml(special)}</p></div>`)

  const charges = email
    ? `
<p style="margin:8px 0 8px;font-size:10px;font-weight:700;letter-spacing:0.1em;color:#94a3b8;text-transform:uppercase;">Charges</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
  <thead>
    <tr>
      <th style="${th}">Description</th>
      <th style="${th}text-align:center;width:56px">Qty</th>
      <th style="${th}text-align:right;width:92px">Unit</th>
      <th style="${th}text-align:right;width:92px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${chargeRow}
    <tr>
      <td colspan="3" style="${td}text-align:right;font-weight:700;border-top:2px solid #0d9488;padding-top:14px;">Total due</td>
      <td style="${td}text-align:right;font-weight:800;font-size:16px;color:#0f172a;border-top:2px solid #0d9488;padding-top:14px;font-variant-numeric:tabular-nums;">${formatInvoiceAmountPhp(grandTotal)}</td>
    </tr>
  </tbody>
</table>`
    : `
<h2 class="inv-h2">Charges</h2>
<table class="inv-tbl inv-charges">
  <thead>
    <tr>
      <th class="inv-th inv-th-head">Description</th>
      <th class="inv-th inv-th-head" style="text-align:center;width:64px">Qty</th>
      <th class="inv-th inv-th-head" style="text-align:right;width:100px">Unit</th>
      <th class="inv-th inv-th-head" style="text-align:right;width:100px">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${singleLine
      ? `<tr>
          <td class="inv-td">${escapeHtml(opts.singleLineDescription || "Accommodation")}</td>
          <td class="inv-td" style="text-align:center">1</td>
          <td class="inv-td inv-num">${formatInvoiceAmountPhp(grandTotal)}</td>
          <td class="inv-td inv-num">${formatInvoiceAmountPhp(grandTotal)}</td>
        </tr>`
      : `<tr>
          <td class="inv-td">${escapeHtml(roomType)} <span class="inv-sub">— stay</span></td>
          <td class="inv-td" style="text-align:center">${nights}</td>
          <td class="inv-td inv-num">${formatInvoiceAmountPhp(ppn)}</td>
          <td class="inv-td inv-num">${formatInvoiceAmountPhp(lineTotal)}</td>
        </tr>`}
    <tr class="inv-total-row">
      <td colspan="3" class="inv-td inv-total-label">Total due</td>
      <td class="inv-td inv-total-val">${formatInvoiceAmountPhp(grandTotal)}</td>
    </tr>
  </tbody>
</table>`

  return metaBlock + detailsTable + (noteBlock || "") + charges
}

export function buildBookingInvoiceEmailInnerHtml(opts) {
  return buildInvoiceBodyHtml(opts, true)
}

/**
 * Full document for print / iframe (includes watermark).
 */
export function buildBookingInvoiceHtml(opts) {
  const b = opts.booking || {}
  const biz = opts.business || {}
  const resortName = String(biz.name || "Resort").trim() || "Resort"
  const wmText = escapeHtml(resortName.length > 42 ? `${resortName.slice(0, 39)}…` : resortName)
  const inner = buildInvoiceBodyHtml(opts, false)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice — ${escapeHtml(String(b.id || ""))}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: #f1f5f9;
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif;
      color: #0f172a;
      font-size: 14px;
      line-height: 1.5;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .watermark {
      position: fixed;
      left: 50%;
      top: 42%;
      transform: translate(-50%, -50%) rotate(32deg);
      font-size: min(14vw, 72px);
      font-weight: 800;
      letter-spacing: -0.03em;
      color: rgba(226, 232, 240, 0.85);
      white-space: nowrap;
      pointer-events: none;
      z-index: 0;
      user-select: none;
    }
    .wrap { position: relative; z-index: 1; padding: 32px 16px 48px; max-width: 720px; margin: 0 auto; }
    .sheet {
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(15, 23, 42, 0.08);
      border: 1px solid #e2e8f0;
      overflow: hidden;
    }
    .sheet-bar { height: 5px; background: linear-gradient(90deg, #0d9488, #14b8a6); }
    .sheet-pad { padding: 28px 32px 32px; }
    .inv-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 28px; }
    .inv-kicker { margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: #0d9488; text-transform: uppercase; }
    .inv-number { margin: 0; font-size: 18px; font-weight: 700; color: #0f172a; }
    .inv-mono { font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; }
    .inv-issued { text-align: right; }
    .inv-issued-l { margin: 0 0 4px; font-size: 12px; color: #64748b; }
    .inv-issued-v { margin: 0; font-size: 14px; font-weight: 600; color: #0f172a; }
    .inv-bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
    @media (max-width: 560px) { .inv-bill-grid { grid-template-columns: 1fr; } }
    .inv-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px 18px;
      background: #fafafa;
    }
    .inv-card-label { margin: 0 0 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #94a3b8; text-transform: uppercase; }
    .inv-strong { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #0f172a; }
    .inv-muted { margin: 0; font-size: 13px; color: #475569; line-height: 1.5; }
    .inv-h2 { margin: 24px 0 10px; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: #94a3b8; text-transform: uppercase; }
    .inv-tbl { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
    .inv-th, .inv-td { padding: 10px 12px; border: 1px solid #e2e8f0; font-size: 14px; vertical-align: top; }
    .inv-th { background: #f8fafc; font-weight: 600; font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .inv-th-head { background: #f1f5f9; }
    .inv-num { text-align: right; font-variant-numeric: tabular-nums; }
    .inv-sub { color: #64748b; font-size: 12px; }
    .inv-note { margin: 16px 0; padding: 14px 16px; background: #f8fafc; border-left: 4px solid #0d9488; border-radius: 0 8px 8px 0; }
    .inv-note-h { margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .inv-note-p { margin: 0; font-size: 13px; color: #475569; line-height: 1.55; }
    .inv-charges .inv-total-row td { border-top: 2px solid #0d9488; padding-top: 14px; }
    .inv-total-label { text-align: right !important; font-weight: 700; border-top: 2px solid #0d9488 !important; }
    .inv-total-val { text-align: right !important; font-weight: 800; font-size: 17px; border-top: 2px solid #0d9488 !important; font-variant-numeric: tabular-nums; }
    .inv-foot { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; line-height: 1.5; }
    @media print {
      body { background: #fff !important; }
      .wrap { padding: 0; }
      .sheet { box-shadow: none !important; border-radius: 0; border: none; }
      .sheet-bar { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="watermark" aria-hidden="true">${wmText}</div>
  <div class="wrap">
    <div class="sheet">
      <div class="sheet-bar"></div>
      <div class="sheet-pad">
        ${inner}
        <p class="inv-foot">Thank you for your booking. For official receipts, follow your accountant’s guidance.</p>
      </div>
    </div>
  </div>
</body>
</html>`
}

export function printBookingInvoiceHtml(html) {
  if (typeof document === "undefined") return false

  const iframe = document.createElement("iframe")
  iframe.setAttribute("title", "Invoice print")
  iframe.setAttribute("aria-hidden", "true")
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;pointer-events:none"

  document.body.appendChild(iframe)

  const idoc = iframe.contentDocument || iframe.contentWindow?.document
  if (!idoc) {
    iframe.remove()
    return false
  }

  idoc.open()
  idoc.write(html)
  idoc.close()

  const win = iframe.contentWindow
  const run = () => {
    try {
      win?.focus()
      win?.print()
    } catch {
      /* ignore */
    }
    setTimeout(() => iframe.remove(), 1200)
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      setTimeout(run, 320)
    })
  })

  return true
}
