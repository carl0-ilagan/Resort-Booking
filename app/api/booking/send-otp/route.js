import { NextResponse } from "next/server"
import { otpStore } from "@/lib/otp-store"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { resolveCentralEnvMail, getResortAdminMailDisplayName } from "@/lib/central-env-mail"
import { resolveEmailBrandName } from "@/lib/resort-mail-branding"
import {
  escapeEmailHtml,
  formalEmailShell,
  formalHeading,
  formalParagraph,
  defaultBookingFooter,
} from "@/lib/booking-email-layout"
import {
  bookingBelongsToTenant,
  getLegacyUnscopedRoomsOwnerUidFromDb,
  normalizeOwnerUid,
  otpStorageKey,
} from "@/lib/booking-tenant"

const MAX_BOOKINGS_PER_EMAIL = 3

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(request) {
  try {
    let { email, ownerUid: rawOwnerUid } = await request.json()
    const legacyUnscopedUid = await getLegacyUnscopedRoomsOwnerUidFromDb(db)

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    email = email.trim().toLowerCase()
    const ownerUid = normalizeOwnerUid(rawOwnerUid)
    const otpKey = otpStorageKey(email, ownerUid)

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    try {
      const bookingsRef = collection(db, "guestbooking")
      const q = query(bookingsRef, where("email", "==", email))
      const querySnapshot = await getDocs(q)
      const existingBookingsCount = querySnapshot.docs.filter((d) =>
        bookingBelongsToTenant(d.data(), ownerUid, legacyUnscopedUid),
      ).length

      if (existingBookingsCount >= MAX_BOOKINGS_PER_EMAIL) {
        return NextResponse.json(
          {
            error: `This email has reached the limit of ${MAX_BOOKINGS_PER_EMAIL} bookings. Please use a different email address.`,
            limitReached: true,
          },
          { status: 400 },
        )
      }
    } catch (limitCheckError) {
      console.error("Error checking booking limit:", limitCheckError)
    }

    const smtp = await resolveCentralEnvMail()
    if (!smtp.ok) {
      console.error("resolveCentralEnvMail:", smtp.code, smtp.message)
      const userMessage =
        smtp.code === "NO_ENV_MAIL"
          ? "Outgoing email is not configured on this deployment. The host needs EMAIL_USER and EMAIL_PASS (or EMAIL_PASSWORD) in server environment variables."
          : smtp.code === "SMTP_VERIFY_FAILED"
            ? "Email login failed (check Gmail app password and account settings). Try again later or contact the resort."
            : "Email could not be sent. Please contact the resort administrator."
      return NextResponse.json(
        {
          error: userMessage,
          code: smtp.code,
          hint: smtp.message,
        },
        { status: 500 },
      )
    }

    const { transporter, user: fromUser, replyTo } = smtp
    const brandName = await resolveEmailBrandName(ownerUid)

    const otp = generateOTP()
    const expiresAt = Date.now() + 5 * 60 * 1000
    otpStore.set(otpKey, { otp, expiresAt })

    const brandEsc = escapeEmailHtml(brandName)
    const otpHtml = escapeEmailHtml(otp)
    const mainHtml = `
      ${formalHeading(`Verification required`, 1)}
      ${formalParagraph(`Dear Guest,`)}
      ${formalParagraph(
        `Thank you for proceeding with a reservation inquiry at <strong style="color:#18181b;">${brandEsc}</strong>. To continue, please enter the following one-time verification code where prompted:`,
      )}
      <div style="margin:28px 0;padding:24px 20px;text-align:center;background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">Verification code</p>
        <p style="margin:0;font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:0.35em;color:#0f172a;">${otpHtml}</p>
      </div>
      ${formalParagraph(`For your security, this code will expire in five minutes.`, "margin-bottom:12px;")}
      ${formalParagraph(`If you did not request this code, you may disregard this message. No changes will be made to your information.`, "font-size:13px;color:#52525b;margin-bottom:0;")}
      ${formalParagraph(`Sincerely,<br/><strong style="color:#18181b;">${brandEsc}</strong>`, "margin-top:28px;margin-bottom:0;")}
    `
    const html = formalEmailShell({
      mainHtml,
      footerHtml: defaultBookingFooter(brandEsc),
      accentColor: "#334155",
    })

    const mailOptions = {
      from: `"${getResortAdminMailDisplayName()}" <${fromUser}>`,
      to: email,
      replyTo,
      subject: `Verification code — ${brandName}`,
      html,
      text: `${brandName} — Verification code\n\nDear Guest,\n\nYour one-time verification code is: ${otp}\n\nThis code expires in five minutes.\n\nIf you did not request this code, please ignore this email.\n\n— ${brandName}`,
    }

    const info = await transporter.sendMail(mailOptions)
    console.log("OTP email sent:", info.messageId)

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully",
    })
  } catch (error) {
    console.error("Error sending OTP:", error)

    return NextResponse.json(
      {
        error: error.message ? `Failed to send OTP. ${error.message}` : "Failed to send OTP. Please try again.",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
