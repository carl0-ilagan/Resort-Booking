import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import { otpStore } from "@/lib/otp-store"
import {
  bookingBelongsToTenant,
  getLegacyUnscopedRoomsOwnerUidFromDb,
  normalizeOwnerUid,
  otpStorageKey,
  roomBelongsToTenant,
} from "@/lib/booking-tenant"
import { resolveEmailBrandName } from "@/lib/resort-mail-branding"
import {
  escapeEmailHtml,
  formalEmailShell,
  formalHeading,
  formalParagraph,
  formalDetailTable,
  defaultBookingFooter,
} from "@/lib/booking-email-layout"

const MAX_BOOKINGS_PER_EMAIL = 3

// Helper function to parse date consistently (handles string "YYYY-MM-DD" format)
function parseDate(dateValue) {
  if (!dateValue) return null
  
  // If it's a Firestore Timestamp
  if (dateValue?.toDate) {
    return dateValue.toDate()
  }
  
  // If it's a Timestamp object with seconds
  if (dateValue?.seconds) {
    return new Date(dateValue.seconds * 1000)
  }
  
  // If it's a string in "YYYY-MM-DD" format
  if (typeof dateValue === "string") {
    // Add time to ensure correct parsing (avoids timezone issues)
    return new Date(dateValue + "T00:00:00")
  }
  
  // Try parsing as-is
  return new Date(dateValue)
}

export async function POST(request) {
  try {
    const legacyUnscopedUid = await getLegacyUnscopedRoomsOwnerUidFromDb(db)
    let {
      name,
      email,
      phone,
      checkIn,
      checkOut,
      guests,
      roomType,
      specialRequests,
      proofOfPaymentUrl,
      validIdUrl,
      otp,
      ownerUid: rawOwnerUid,
    } = await request.json()

    // Normalize email: trim whitespace and convert to lowercase
    email = email ? email.trim().toLowerCase() : ""
    const ownerUid = normalizeOwnerUid(rawOwnerUid)
    const otpKey = otpStorageKey(email, ownerUid)

    // Validate required fields
    if (!name || !email || !phone || !checkIn || !checkOut || !guests || !roomType || !otp) {
      return NextResponse.json(
        { error: "All required fields must be filled" },
        { status: 400 }
      )
    }

    if (ownerUid && (!proofOfPaymentUrl || !validIdUrl)) {
      return NextResponse.json(
        { error: "Please upload proof of payment and 1 valid ID before confirming." },
        { status: 400 },
      )
    }

    // Check booking limit for this email
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
            limitReached: true
          },
          { status: 400 }
        )
      }
    } catch (limitCheckError) {
      console.error("Error checking booking limit:", limitCheckError)
      // Continue with booking if limit check fails (don't block legitimate bookings)
    }

    // Trim OTP (remove any spaces)
    otp = otp.trim()

    // Debug: Log the email being used for lookup
    console.log("Verifying OTP for email:", email)
    console.log("OTP store keys:", Array.from(otpStore.keys()))
    console.log("OTP store size:", otpStore.size)
    console.log(
      "OTP store entries:",
      Array.from(otpStore.entries()).map(([e, d]) => ({
        key: e,
        otp: d.otp,
        expiresAt: new Date(d.expiresAt).toISOString(),
      })),
    )

    // Verify OTP
    const storedData = otpStore.get(otpKey)
    
    console.log("Stored data for email:", storedData ? { otp: storedData.otp, expiresAt: new Date(storedData.expiresAt).toISOString(), isExpired: storedData.expiresAt < Date.now() } : "NOT FOUND")
    
    if (!storedData) {
      console.error("OTP not found for key:", otpKey)
      console.error("Available keys in store:", Array.from(otpStore.keys()))
      return NextResponse.json(
        { 
          error: "OTP not found. Please request a new OTP.",
          debug: process.env.NODE_ENV === "development" ? {
            lookupKey: otpKey,
            availableKeys: Array.from(otpStore.keys())
          } : undefined
        },
        { status: 400 }
      )
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(otpKey)
      return NextResponse.json(
        { error: "OTP has expired. Please request a new OTP." },
        { status: 400 }
      )
    }

    if (storedData.otp !== otp) {
      console.error("OTP mismatch. Expected:", storedData.otp, "Received:", otp)
      return NextResponse.json(
        { error: "Invalid OTP. Please try again." },
        { status: 400 }
      )
    }

    console.log("OTP verified successfully for email:", email)

    // Check for date conflicts with existing bookings for the same room type
    try {
      const trimmedRoomType = roomType.trim()
      const bookingsRef = collection(db, "guestbooking")
      // Get all bookings for the same room type
      const q = query(bookingsRef, where("roomType", "==", trimmedRoomType))
      const querySnapshot = await getDocs(q)
      const tenantBookings = querySnapshot.docs.filter((d) =>
        bookingBelongsToTenant(d.data(), ownerUid, legacyUnscopedUid),
      )
      
      console.log(
        `Verifying OTP - Found ${tenantBookings.length} tenant-scoped bookings for room type: "${trimmedRoomType}"`,
      )
      
      // Parse dates using helper function
      const newCheckIn = parseDate(checkIn.trim())
      const newCheckOut = parseDate(checkOut.trim())
      
      if (!newCheckIn || !newCheckOut) {
        return NextResponse.json(
          { error: "Invalid date format" },
          { status: 400 }
        )
      }
      
      console.log("Verifying OTP - Checking date conflicts:", {
        roomType: roomType.trim(),
        newCheckIn: checkIn.trim(),
        newCheckOut: checkOut.trim(),
        totalBookings: tenantBookings.length,
      })
      
      // Check for date overlaps (only for APPROVED bookings)
      const hasConflict = tenantBookings.some((doc) => {
        const existingBooking = doc.data()
        // Trim status to handle "Approved " with trailing space
        const status = existingBooking.status?.trim() || existingBooking.status
        const existingRoomType = existingBooking.roomType?.trim() || existingBooking.roomType
        
        // Double-check room type match (case-insensitive)
        if (existingRoomType?.toLowerCase() !== trimmedRoomType.toLowerCase()) {
          console.log("Skipping - room type doesn't match:", existingRoomType, "vs", trimmedRoomType)
          return false
        }
        
        // Only check conflicts for APPROVED bookings
        // Pending, Cancelled, or Rejected bookings don't block new bookings
        // Only Approved bookings block dates (admin has confirmed the booking)
        if (status !== "Approved") {
          console.log("Skipping - status is not Approved (only Approved bookings block dates):", status)
          return false
        }
        
        // Parse dates using helper function
        const existingCheckIn = parseDate(existingBooking.checkIn)
        const existingCheckOut = parseDate(existingBooking.checkOut)
        
        if (!existingCheckIn || !existingCheckOut) {
          console.log("Skipping - invalid dates in existing booking")
          return false
        }
        
        // Reset time to midnight for accurate date comparison
        existingCheckIn.setHours(0, 0, 0, 0)
        existingCheckOut.setHours(0, 0, 0, 0)
        newCheckIn.setHours(0, 0, 0, 0)
        newCheckOut.setHours(0, 0, 0, 0)
        
        console.log("Comparing dates:", {
          existing: {
            checkIn: existingCheckIn.toISOString().split("T")[0],
            checkOut: existingCheckOut.toISOString().split("T")[0],
            status: status,
          },
          new: {
            checkIn: newCheckIn.toISOString().split("T")[0],
            checkOut: newCheckOut.toISOString().split("T")[0],
          },
        })
        
        // Check if dates overlap: new booking starts before existing ends AND new booking ends after existing starts
        // This covers all overlap cases including exact matches
        const overlaps = newCheckIn < existingCheckOut && newCheckOut > existingCheckIn
        
        if (overlaps) {
          console.log("⚠️ Date conflict found!")
        }
        
        return overlaps
      })

      if (hasConflict) {
        return NextResponse.json(
          { 
            error: "This room is already booked for the selected dates. Please choose different dates or a different room.",
            dateConflict: true
          },
          { status: 400 }
        )
      }
    } catch (dateCheckError) {
      console.error("Error checking date conflicts:", dateCheckError)
      // Continue with booking if date check fails (don't block legitimate bookings)
    }

    // Calculate price per night from room data
    let pricePerNight = 0
    try {
      const { collection: roomsCollection, getDocs, query: roomsQuery, where: roomsWhere } = await import("firebase/firestore")
      const roomsRef = roomsCollection(db, "rooms")
      const trimmedRoomType = roomType.trim()
      
      // Get all rooms for flexible matching
      const allRoomsSnapshot = await getDocs(roomsRef)
      const tenantRoomDocs = allRoomsSnapshot.docs.filter((d) =>
        roomBelongsToTenant(d.data(), ownerUid, legacyUnscopedUid),
      )
      
      if (tenantRoomDocs.length) {
        // Try exact match by name first (case-insensitive)
        let matchedRoom = tenantRoomDocs.find(doc => {
          const data = doc.data()
          return data.name?.trim().toLowerCase() === trimmedRoomType.toLowerCase()
        })
        
        // If no match by name, try by type
        if (!matchedRoom) {
          matchedRoom = tenantRoomDocs.find(doc => {
            const data = doc.data()
            return data.type?.trim().toLowerCase() === trimmedRoomType.toLowerCase()
          })
        }
        
        // If still no match, try partial match
        if (!matchedRoom) {
          matchedRoom = tenantRoomDocs.find(doc => {
            const data = doc.data()
            const roomTypeLower = data.type?.trim().toLowerCase() || ""
            const roomNameLower = data.name?.trim().toLowerCase() || ""
            const searchLower = trimmedRoomType.toLowerCase()
            return roomTypeLower.includes(searchLower) || roomNameLower.includes(searchLower) ||
                   searchLower.includes(roomTypeLower) || searchLower.includes(roomNameLower)
          })
        }
        
        if (matchedRoom) {
          const roomData = matchedRoom.data()
          
          // Check room availability - only "Available" rooms can be booked
          const availability = roomData.availability?.trim() || roomData.availability
          if (availability && availability !== "Available") {
            return NextResponse.json(
              { 
                error: `This room is currently ${availability.toLowerCase()}. Only available rooms can be booked.`,
                roomUnavailable: true
              },
              { status: 400 }
            )
          }
          
          const price = Number(roomData.price) || 0
          const discount = Number(roomData.discount) || 0
          pricePerNight = discount > 0 ? price * (1 - discount / 100) : price
          console.log(`✅ Price calculated during booking: ${pricePerNight} per night for "${trimmedRoomType}"`)
        } else {
          console.warn(`⚠️ Room not found for price calculation: "${trimmedRoomType}"`)
        }
      }
    } catch (priceError) {
      console.error("Error calculating price during booking:", priceError)
      // Continue without price - will be calculated later during approval
    }

    // OTP verified - save booking to Firestore
    const bookingData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      checkIn: checkIn.trim(),
      checkOut: checkOut.trim(),
      guests: parseInt(guests, 10),
      roomType: roomType.trim(),
      specialRequests: specialRequests ? specialRequests.trim() : "",
      status: "Pending", // Admin can approve later
      ...(ownerUid
        ? {
            paymentMethod: "gcash_qr",
            proofOfPaymentUrl: String(proofOfPaymentUrl || "").trim(),
            validIdUrl: String(validIdUrl || "").trim(),
          }
        : {}),
      pricePerNight: pricePerNight > 0 ? pricePerNight : null, // Store price if found
      createdAt: serverTimestamp(),
      verifiedAt: serverTimestamp(),
      ...(ownerUid ? { ownerUid } : {}),
    }

    // Validate guests is a valid number
    if (isNaN(bookingData.guests) || bookingData.guests < 1) {
      return NextResponse.json(
        { error: "Invalid number of guests" },
        { status: 400 }
      )
    }

    console.log("Saving booking to Firestore:", bookingData)
    console.log("DB instance:", db ? "Initialized" : "Not initialized")

    // Verify db is initialized
    if (!db) {
      throw new Error("Firestore database not initialized")
    }

    try {
      const bookingsCollection = collection(db, "guestbooking")
      console.log("Collection reference created:", bookingsCollection)
      
      const docRef = await addDoc(bookingsCollection, bookingData)
      console.log("Booking saved successfully with ID:", docRef.id)

      // Remove used OTP
      otpStore.delete(otpKey)

      const emailBrandName = await resolveEmailBrandName(ownerUid)

      // Notify resort (same mailbox as OTP — Guest emails + FIREBASE_SERVICE_ACCOUNT_JSON)
      try {
        const { resolveCentralEnvMail, resolveAdminInboxEmail, getResortAdminMailDisplayName } =
          await import("@/lib/central-env-mail")
        const smtp = await resolveCentralEnvMail()
        const adminEmail =
          smtp.ok &&
          resolveAdminInboxEmail({
            brandingEmail: smtp.brandingEmail,
            replyTo: smtp.replyTo,
            smtpUser: smtp.user,
          })

        if (smtp.ok && adminEmail) {
          const formatDate = (dateString) => {
            if (!dateString) return "N/A"
            try {
              const date = new Date(dateString + "T00:00:00")
              return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            } catch {
              return dateString
            }
          }

          const brandEsc = escapeEmailHtml(emailBrandName)
          const adminRows = [
            { label: "Booking reference", value: escapeEmailHtml(docRef.id) },
            { label: "Guest name", value: escapeEmailHtml(name) },
            { label: "Email", value: escapeEmailHtml(email) },
            { label: "Phone", value: escapeEmailHtml(phone) },
            { label: "Room", value: escapeEmailHtml(roomType) },
            { label: "Check-in", value: escapeEmailHtml(formatDate(checkIn)) },
            { label: "Check-out", value: escapeEmailHtml(formatDate(checkOut)) },
            { label: "Guests", value: escapeEmailHtml(String(guests)) },
            ...(specialRequests
              ? [{ label: "Special requests", value: escapeEmailHtml(specialRequests) }]
              : []),
            { label: "Status", value: `<strong style="color:#b45309;">Pending review</strong>` },
          ]
          const adminMainHtml = `
            ${formalHeading("New reservation request", 1)}
            ${formalParagraph(
              `A new reservation request has been submitted for <strong style="color:#18181b;">${brandEsc}</strong> and requires your attention.`,
            )}
            ${formalDetailTable(adminRows)}
            ${formalParagraph(
              `Please review this request in your administration dashboard and approve or decline it when convenient.`,
            )}
            ${formalParagraph(
              `This message was generated automatically when the guest completed verification.`,
              "font-size:13px;color:#52525b;margin-bottom:0;",
            )}
          `
          const mailOptions = {
            from: `"${getResortAdminMailDisplayName()}" <${smtp.user}>`,
            to: adminEmail,
            replyTo: smtp.replyTo,
            subject: `New reservation request — ${emailBrandName}`,
            html: formalEmailShell({
              mainHtml: adminMainHtml,
              footerHtml: defaultBookingFooter(brandEsc),
              accentColor: "#334155",
            }),
            text: `New reservation request — ${emailBrandName}\n\nBooking reference: ${docRef.id}\nGuest name: ${name}\nEmail: ${email}\nPhone: ${phone}\nRoom: ${roomType}\nCheck-in: ${formatDate(checkIn)}\nCheck-out: ${formatDate(checkOut)}\nGuests: ${guests}${specialRequests ? `\nSpecial requests: ${specialRequests}` : ""}\nStatus: Pending review\n\nPlease review this request in your administration dashboard.\n\n— Automated notification`,
          }

          await smtp.transporter.sendMail(mailOptions)
          console.log("Admin notification email sent successfully")
        }
      } catch (emailError) {
        console.error("Error sending admin notification email:", emailError)
        // Don't fail the booking if email fails
      }

      // Guest confirmation: pending admin approval (no payment link)
      try {
        const { resolveCentralEnvMail } = await import("@/lib/central-env-mail")
        const smtp = await resolveCentralEnvMail()
        if (smtp.ok) {
          const formatDate = (dateString) => {
            if (!dateString) return "N/A"
            try {
              const date = new Date(dateString + "T00:00:00")
              return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            } catch {
              return dateString
            }
          }
          const guestNameEsc = escapeEmailHtml(name || "Guest")
          const guestBrandEsc = escapeEmailHtml(emailBrandName)
          const guestRows = [
            { label: "Booking reference", value: escapeEmailHtml(docRef.id) },
            { label: "Room", value: escapeEmailHtml(roomType) },
            { label: "Check-in", value: escapeEmailHtml(formatDate(checkIn)) },
            { label: "Check-out", value: escapeEmailHtml(formatDate(checkOut)) },
          ]
          const guestMainHtml = `
            ${formalHeading("Reservation request received", 1)}
            ${formalParagraph(`Dear ${guestNameEsc},`)}
            ${formalParagraph(
              `Thank you for your reservation request at <strong style="color:#18181b;">${guestBrandEsc}</strong>. Your submission has been received and is now subject to confirmation by the property.`,
            )}
            ${formalDetailTable(guestRows)}
            ${formalParagraph(
              `You will receive a separate message once your request has been reviewed. No further action is required from you at this time.`,
            )}
            ${formalParagraph(`Respectfully,<br/><strong style="color:#18181b;">${guestBrandEsc}</strong>`, "margin-top:28px;margin-bottom:0;")}
          `
          await smtp.transporter.sendMail({
            from: `"${getResortAdminMailDisplayName()}" <${smtp.user}>`,
            to: email,
            replyTo: smtp.replyTo,
            subject: `Reservation request received — ${emailBrandName}`,
            html: formalEmailShell({
              mainHtml: guestMainHtml,
              footerHtml: defaultBookingFooter(guestBrandEsc),
              accentColor: "#334155",
            }),
            text: `Reservation request received — ${emailBrandName}\n\nDear ${name || "Guest"},\n\nThank you for your reservation request. Your submission is pending confirmation.\n\nBooking reference: ${docRef.id}\nRoom: ${roomType}\nCheck-in: ${formatDate(checkIn)}\nCheck-out: ${formatDate(checkOut)}\n\nYou will be notified by email when your request has been reviewed.\n\n— ${emailBrandName}`,
          })
          console.log("Guest confirmation email sent successfully")
        }
      } catch (guestMailError) {
        console.error("Error sending guest confirmation email:", guestMailError)
      }

      return NextResponse.json({
        success: true,
        message: "Booking confirmed successfully",
        bookingId: docRef.id,
      })
    } catch (firestoreError) {
      console.error("Firestore error:", firestoreError)
      console.error("Error code:", firestoreError.code)
      console.error("Error message:", firestoreError.message)
      throw firestoreError // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("Error verifying OTP and saving booking:", error)
    console.error("Error stack:", error.stack)
    
    // Provide more detailed error message
    let errorMessage = "Failed to complete booking. Please try again."
    if (error.message) {
      errorMessage += ` Error: ${error.message}`
    }
    if (error.code) {
      errorMessage += ` (Code: ${error.code})`
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? {
          message: error.message,
          code: error.code,
          stack: error.stack
        } : undefined
      },
      { status: 500 }
    )
  }
}

