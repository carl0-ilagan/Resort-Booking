import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { getAccountFromIdToken } from "@/lib/firebase-id-token"
import {
  resolveCentralEnvMail,
  sanitizeMailDisplayName,
  getResortAdminMailDisplayName,
} from "@/lib/central-env-mail"
import { computeBookingInvoiceOpts } from "@/lib/booking-invoice-model"
import { invoiceComputeHelpers } from "@/lib/booking-invoice-helpers"
import { buildBookingInvoiceEmailInnerHtml } from "@/lib/booking-invoice-html"
import {
  escapeEmailHtml,
  formalEmailShell,
  formalHeading,
  formalParagraph,
  defaultBookingFooter,
  sanitizeSubjectFragment,
} from "@/lib/booking-email-layout"

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}))
    const bookingId = String(body.bookingId || "").trim()
    const idToken = String(body.idToken || "").trim()

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    const account = await getAccountFromIdToken(idToken)
    if (!account?.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const bookingRef = doc(db, "guestbooking", bookingId)
    const bookingSnap = await getDoc(bookingRef)
    if (!bookingSnap.exists()) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 })
    }

    const booking = { id: bookingSnap.id, ...bookingSnap.data() }
    const ownerUid = String(booking.ownerUid || "").trim()
    if (!ownerUid || ownerUid !== account.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const guestEmail = String(booking.email || "")
      .trim()
      .toLowerCase()
    if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
      return NextResponse.json({ error: "Guest email missing or invalid on this booking" }, { status: 400 })
    }

    const brandRef = doc(db, "resortOwners", account.uid, "site", "branding")
    const brandSnap = await getDoc(brandRef)
    const rawBrand = brandSnap.exists() ? brandSnap.data() : {}
    const invoiceBusiness = {
      name: typeof rawBrand.name === "string" ? rawBrand.name : "",
      address: typeof rawBrand.address === "string" ? rawBrand.address : "",
      phone: typeof rawBrand.phone === "string" ? rawBrand.phone : "",
      email: typeof rawBrand.email === "string" ? rawBrand.email : "",
    }

    const opts = computeBookingInvoiceOpts(booking, invoiceBusiness, invoiceComputeHelpers)
    const invoiceHtml = buildBookingInvoiceEmailInnerHtml(opts)

    const resortDisplay = sanitizeMailDisplayName(invoiceBusiness.name || "Resort")
    const guestFirst = escapeEmailHtml(String(booking.name || "Guest"))

    const mainHtml =
      formalHeading("Your booking invoice", 1) +
      formalParagraph(`Hi ${guestFirst},`) +
      formalParagraph(
        `Your invoice from <strong>${escapeEmailHtml(String(invoiceBusiness.name || "Resort").trim() || "Resort")}</strong> is below.`,
      ) +
      invoiceHtml

    const footerHtml = defaultBookingFooter(escapeEmailHtml(resortDisplay))

    const html = formalEmailShell({
      mainHtml,
      footerHtml,
      accentColor: "#0d9488",
    })

    const mail = await resolveCentralEnvMail()
    if (!mail.ok) {
      return NextResponse.json(
        { error: mail.message, code: mail.code || "MAIL_UNAVAILABLE" },
        { status: 503 },
      )
    }

    const subject = sanitizeSubjectFragment(
      `Invoice ${String(booking.roomType || "booking").slice(0, 40)} — ${resortDisplay}`,
    )

    await mail.transporter.sendMail({
      from: `"${getResortAdminMailDisplayName()}" <${mail.user}>`,
      to: guestEmail,
      replyTo: mail.replyTo,
      subject,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("send-invoice:", e)
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
