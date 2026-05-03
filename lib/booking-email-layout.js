/**
 * Formal transactional email shell — table-based layout, inline CSS for broad client support.
 */

export const EMAIL_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif"

export function escapeEmailHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Single-line safe subject fragment (no newlines). */
export function sanitizeSubjectFragment(value, maxLen = 120) {
  const s = String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLen)
  return s || "Guest"
}

/**
 * Outer wrapper: light gray background, white card, top accent bar, footer strip.
 */
export function formalEmailShell({ mainHtml, footerHtml, accentColor = "#334155" }) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f4f4f5;margin:0;padding:28px 14px;font-family:${EMAIL_FONT_FAMILY};">
  <tr>
    <td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e4e4e7;border-radius:4px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
        <tr>
          <td style="height:3px;background:${accentColor};font-size:0;line-height:0;">&nbsp;</td>
        </tr>
        <tr>
          <td style="padding:36px 40px 32px;color:#18181b;font-size:15px;line-height:1.65;">
            ${mainHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 32px;border-top:1px solid #f4f4f5;color:#71717a;font-size:12px;line-height:1.55;">
            ${footerHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`
}

export function formalParagraph(text, style = "") {
  return `<p style="margin:0 0 16px;color:#27272a;font-size:15px;line-height:1.65;${style}">${text}</p>`
}

export function formalHeading(text, level = 2) {
  const spacing =
    level === 1
      ? "margin:0 0 20px;color:#0f172a;font-size:22px;line-height:1.3;font-weight:600;letter-spacing:-0.02em;"
      : "margin:24px 0 12px;color:#0f172a;font-size:13px;line-height:1.4;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;"
  const Tag = level === 1 ? "h1" : "p"
  return `<${Tag} style="${spacing}font-family:${EMAIL_FONT_FAMILY};">${text}</${Tag}>`
}

/** Label/value rows for reservation details */
export function formalDetailTable(rows) {
  const rowsHtml = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 16px 10px 0;color:#52525b;font-size:13px;vertical-align:top;width:38%;border-bottom:1px solid #f4f4f5;">${r.label}</td>
      <td style="padding:10px 0;color:#18181b;font-size:14px;vertical-align:top;border-bottom:1px solid #f4f4f5;">${r.value}</td>
    </tr>`,
    )
    .join("")
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:20px 0;border:1px solid #e4e4e7;border-radius:4px;overflow:hidden;">
  ${rowsHtml}
</table>`
}

export function formalNoticeBox(innerHtml, { borderColor = "#cbd5e1", bg = "#f8fafc" } = {}) {
  return `
<div style="margin:22px 0;padding:16px 18px;background-color:${bg};border-left:3px solid ${borderColor};border-radius:0 4px 4px 0;">
  ${innerHtml}
</div>`
}

export function defaultBookingFooter(brandNameEscaped) {
  return `
<p style="margin:0 0 8px;">This is an automated notification relating to your reservation at <strong style="color:#3f3f46;">${brandNameEscaped}</strong>.</p>
<p style="margin:0;">Please do not reply to this message unless you were instructed to. For assistance, use the contact information published for the property.</p>`
}
