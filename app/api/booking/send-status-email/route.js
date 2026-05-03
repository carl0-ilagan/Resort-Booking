import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"
import { resolveCentralEnvMail, getResortAdminMailDisplayName } from "@/lib/central-env-mail"
import { resolveEmailBrandName } from "@/lib/resort-mail-branding"
import {
  escapeEmailHtml,
  formalEmailShell,
  formalHeading,
  formalParagraph,
  formalDetailTable,
  formalNoticeBox,
  defaultBookingFooter,
} from "@/lib/booking-email-layout"
import {
  getLegacyUnscopedRoomsOwnerUidFromDb,
  normalizeOwnerUid,
  roomBelongsToTenant,
} from "@/lib/booking-tenant"
// Payment links are no longer generated for guest checkout.

// Helper function to calculate number of nights
function calculateNights(checkIn, checkOut) {
  try {
    // Handle both string (YYYY-MM-DD) and Date object formats
    let checkInDate, checkOutDate
    
    if (typeof checkIn === 'string') {
      // If it's already in ISO format or has time, use it directly
      checkInDate = checkIn.includes('T') ? new Date(checkIn) : new Date(checkIn + "T00:00:00")
    } else {
      checkInDate = new Date(checkIn)
    }
    
    if (typeof checkOut === 'string') {
      checkOutDate = checkOut.includes('T') ? new Date(checkOut) : new Date(checkOut + "T00:00:00")
    } else {
      checkOutDate = new Date(checkOut)
    }
    
    // Validate dates
    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      console.error("Invalid date format:", { checkIn, checkOut })
      return 1
    }
    
    // Reset to midnight for accurate day calculation
    checkInDate.setHours(0, 0, 0, 0)
    checkOutDate.setHours(0, 0, 0, 0)
    
    // Calculate difference in milliseconds
    const diffTime = checkOutDate.getTime() - checkInDate.getTime()
    
    // Convert to days (positive difference)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    // Ensure at least 1 night
    const nights = diffDays > 0 ? diffDays : 1
    
    console.log(`Calculated nights: ${nights} (checkIn: ${checkInDate.toISOString().split('T')[0]}, checkOut: ${checkOutDate.toISOString().split('T')[0]})`)
    
    return nights
  } catch (error) {
    console.error("Error calculating nights:", error, { checkIn, checkOut })
    return 1
  }
}

// Helper function to fetch room data (name and price) from Firestore
async function getRoomData(roomType, ownerUid = null, legacyUnscopedUid = null) {
  try {
    const tenantUid = normalizeOwnerUid(ownerUid)
    const roomsRef = collection(db, "rooms")
    const allRoomsSnapshot = await getDocs(roomsRef)
    const tenantDocs = allRoomsSnapshot.docs.filter((d) =>
      roomBelongsToTenant(d.data(), tenantUid, legacyUnscopedUid),
    )
    
    if (!tenantDocs.length) {
      console.warn("No rooms found in Firestore for tenant scope")
      return { name: null, price: 0 }
    }

    // If roomType is provided and not empty/WALA, try to match
    if (roomType && roomType.trim() && roomType.trim() !== "WALA") {
      const trimmedRoomType = roomType.trim()
      console.log(`Searching for room: "${trimmedRoomType}"`)
      
      // Log all available room types and names for debugging
      const availableRooms = tenantDocs.map(doc => {
        const data = doc.data()
        return { id: doc.id, type: data.type, name: data.name, price: data.price }
      })
      console.log("Available rooms:", JSON.stringify(availableRooms, null, 2))

      // Try exact match by type (case-insensitive)
      let matchedRoom = tenantDocs.find(doc => {
        const data = doc.data()
        return data.type?.trim().toLowerCase() === trimmedRoomType.toLowerCase()
      })

      // If no match by type, try exact match by name (case-insensitive)
      if (!matchedRoom) {
        matchedRoom = tenantDocs.find(doc => {
          const data = doc.data()
          return data.name?.trim().toLowerCase() === trimmedRoomType.toLowerCase()
        })
      }

      // If still no match, try partial match (contains)
      if (!matchedRoom) {
        matchedRoom = tenantDocs.find(doc => {
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
        const price = Number(roomData.price) || 0
        const discount = Number(roomData.discount) || 0
        const finalPrice = discount > 0 ? price * (1 - discount / 100) : price
        const roomName = roomData.name?.trim() || roomData.type?.trim() || trimmedRoomType
        console.log(`✅ Room found for "${trimmedRoomType}": name="${roomName}", price=${price}, discount=${discount}%, final=${finalPrice}`)
        return { name: roomName, price: finalPrice }
      }
      
      // If room not found, log warning
      console.error(`❌ Room not found in Firestore for: "${trimmedRoomType}"`)
      console.error("Available room types:", availableRooms.map(r => r.type).filter(Boolean).join(", "))
      console.error("Available room names:", availableRooms.map(r => r.name).filter(Boolean).join(", "))
    }
    
    // If roomType is empty/WALA, try to get first available room or return null
    console.log("⚠️ roomType is empty or 'WALA', trying to find any available room...")
    const availableRoom = tenantDocs.find(doc => {
      const data = doc.data()
      const availability = data.availability?.trim() || data.availability
      return !availability || availability === "Available"
    })
    
    if (availableRoom) {
      const roomData = availableRoom.data()
      const price = Number(roomData.price) || 0
      const discount = Number(roomData.discount) || 0
      const finalPrice = discount > 0 ? price * (1 - discount / 100) : price
      const roomName = roomData.name?.trim() || roomData.type?.trim() || "Standard Room"
      console.log(`✅ Using first available room: name="${roomName}", price=${finalPrice}`)
      return { name: roomName, price: finalPrice }
    }
    
    return { name: null, price: 0 }
  } catch (error) {
    console.error("Error fetching room data:", error)
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
    })
    return { name: null, price: 0 }
  }
}

// Helper function to fetch room price from Firestore (backward compatibility)
async function getRoomPrice(roomType, ownerUid = null, legacyUnscopedUid = null) {
  const roomData = await getRoomData(roomType, ownerUid, legacyUnscopedUid)
  return roomData.price
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export async function POST(request) {
  try {
    const legacyUnscopedUid = await getLegacyUnscopedRoomsOwnerUidFromDb(db)
    let { email, name, roomType, checkIn, checkOut, status, bookingId, reason, ownerUid: rawBodyOwnerUid } =
      await request.json()
    let bookingOwnerUid = null
    const bodyOwnerUid = normalizeOwnerUid(rawBodyOwnerUid)

    if (!email || !status) {
      return NextResponse.json({ error: "Email and status are required" }, { status: 400 })
    }
    
    console.log("Send status email called:", { email, name, roomType, checkIn, checkOut, status, bookingId })

    // Always fetch booking document if bookingId is available to ensure we have the latest data
    if (bookingId) {
      try {
        const { doc, getDoc } = await import("firebase/firestore")
        const bookingRef = doc(db, "guestbooking", bookingId)
        const bookingDoc = await getDoc(bookingRef)
        if (bookingDoc.exists()) {
          const bookingData = bookingDoc.data()
          bookingOwnerUid = normalizeOwnerUid(bookingData.ownerUid)
          // Use booking document as source of truth - prioritize booking document data
          const fetchedRoomType = bookingData.roomType?.trim() || ""
          roomType = fetchedRoomType || roomType || ""
          checkIn = bookingData.checkIn || checkIn
          checkOut = bookingData.checkOut || checkOut
          email = bookingData.email || email
          name = bookingData.name || name
          
          console.log("✅ Fetched booking data from Firestore:", { 
            bookingId,
            roomType: roomType || "EMPTY", 
            checkIn, 
            checkOut, 
            email, 
            name,
            allBookingFields: Object.keys(bookingData)
          })
          
          // Log the full booking data for debugging
          console.log("📋 Full booking document:", JSON.stringify(bookingData, null, 2))
          
          // If roomType is still empty, log warning
          if (!roomType || roomType === "" || roomType === "WALA") {
            console.error("⚠️ WARNING: roomType is empty or 'WALA' in booking document:", bookingId)
            console.error("This will prevent price calculation and payment link generation!")
          }
        } else {
          console.warn("⚠️ Booking document not found:", bookingId)
        }
      } catch (fetchError) {
        console.error("❌ Error fetching booking document:", fetchError)
        console.error("Error details:", {
          message: fetchError.message,
          stack: fetchError.stack,
        })
        // Continue with provided data if fetch fails
      }
    } else {
      console.warn("⚠️ No bookingId provided - cannot fetch booking document from Firestore")
    }

    const central = await resolveCentralEnvMail()
    if (!central.ok) {
      console.error("send-status-email:", central.code, central.message)
      return NextResponse.json(
        {
          error: "Email service not configured",
          hint: central.message,
        },
        { status: 500 },
      )
    }

    const { transporter, user: fromUser, replyTo: centralReplyTo } = central
    const mailSource = "env"

    // Format dates
    const formatDate = (dateString) => {
      if (!dateString) return "N/A"
      try {
        const date = new Date(dateString + "T00:00:00")
        return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      } catch {
        return dateString
      }
    }

    const formattedCheckIn = formatDate(checkIn)
    const formattedCheckOut = formatDate(checkOut)

    // Calculate total amount for approved bookings
    let totalAmount = 0
    let numberOfNights = 0
    let paymentLink = null
    let displayRoomName = roomType || "N/A"
    let paymentErrorDetails = null
    let paymentProviderLabel = "PayMongo"

    // Normalize roomType - trim and validate
    if (roomType) {
      roomType = roomType.trim()
      // Replace "WALA" with empty string
      if (roomType === "WALA") {
        roomType = ""
      }
    }

    // Always calculate nights if we have dates (for approved bookings)
    if (status === "Approved" && checkIn && checkOut) {
      numberOfNights = calculateNights(checkIn, checkOut)
      console.log(`Calculated nights: ${numberOfNights} (checkIn: ${checkIn}, checkOut: ${checkOut})`)
    }

    // Calculate price and create payment link if we have valid room type OR if we have bookingId (try to get price from booking)
    let pricePerNight = 0
    
    if (status === "Approved" && checkIn && checkOut && numberOfNights > 0) {
      // Try to get price from booking document first (if stored during booking creation)
      if (bookingId) {
        try {
          const { doc, getDoc } = await import("firebase/firestore")
          const bookingRef = doc(db, "guestbooking", bookingId)
          const bookingDoc = await getDoc(bookingRef)
          if (bookingDoc.exists()) {
            const bookingData = bookingDoc.data()
            bookingOwnerUid = bookingOwnerUid || normalizeOwnerUid(bookingData.ownerUid)
            // Check if price was stored in booking
            if (bookingData.pricePerNight || bookingData.totalPrice) {
              pricePerNight = Number(bookingData.pricePerNight) || (Number(bookingData.totalPrice) / numberOfNights)
              console.log(`✅ Found price in booking document: ${pricePerNight} per night`)
            }
          }
        } catch (error) {
          console.error("Error fetching price from booking:", error)
        }
      }
      
      // Get room data (name and price) from room lookup - this will handle WALA/empty roomType
      if (pricePerNight === 0 || !roomType || roomType === "") {
        console.log(`Getting room data: roomType="${roomType || 'EMPTY'}", checkIn="${checkIn}", checkOut="${checkOut}", nights=${numberOfNights}`)
        const roomData = await getRoomData(roomType, bookingOwnerUid, legacyUnscopedUid)
        if (roomData.name) {
          displayRoomName = roomData.name
          // Update booking document with correct room name if we found one
          if (bookingId && (!roomType || roomType === "" || roomType === "WALA")) {
            try {
              const { doc, updateDoc } = await import("firebase/firestore")
              const bookingRef = doc(db, "guestbooking", bookingId)
              await updateDoc(bookingRef, {
                roomType: roomData.name,
              })
              console.log(`✅ Updated booking ${bookingId} with room name: ${roomData.name}`)
            } catch (updateError) {
              console.error("Error updating booking with room name:", updateError)
            }
          }
        }
        if (roomData.price > 0) {
          pricePerNight = roomData.price
          console.log(`Price per night from room lookup: ${pricePerNight}`)
        }
      } else if (roomType && roomType !== "") {
        // If we have roomType, get the actual room name for display
        const roomData = await getRoomData(roomType, bookingOwnerUid, legacyUnscopedUid)
        if (roomData.name) {
          displayRoomName = roomData.name
        }
      }
      
      // Calculate total amount
      if (pricePerNight > 0 && numberOfNights > 0) {
        totalAmount = pricePerNight * numberOfNights
        console.log(`Total amount calculated: ${totalAmount} (${pricePerNight} × ${numberOfNights})`)
      } else {
        console.warn(`Cannot calculate total: pricePerNight=${pricePerNight}, numberOfNights=${numberOfNights}, roomType="${roomType || 'EMPTY'}"`)
      }
      
      // Payment link generation removed (GCash QR + manual verification).
    } else {
      console.warn("Cannot create payment link: missing required fields", {
        status,
        roomType,
        checkIn,
        checkOut,
      })
    }

    const brandName = await resolveEmailBrandName(bookingOwnerUid || bodyOwnerUid)
    const brandNameHtml = escapeHtml(brandName)

    // Email content based on status
    let subject, htmlContent, textContent

    const guestNameEsc = escapeEmailHtml(name || "Valued Guest")
    const brandFooterEsc = escapeEmailHtml(brandName)

    if (status === "Approved") {
      subject = `Reservation confirmed — ${brandName}`
      const roomLabel =
        displayRoomName && displayRoomName !== "N/A"
          ? escapeEmailHtml(displayRoomName)
          : "Please contact the property for accommodation details."
      const totalCell =
        totalAmount > 0
          ? `<strong style="color:#0f172a;">₱${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>`
          : `<span style="color:#52525b;">Total not listed — please contact the property.</span>`
      const approvedRows = [
        { label: "Accommodation", value: roomLabel },
        { label: "Check-in", value: escapeEmailHtml(formattedCheckIn) },
        { label: "Check-out", value: escapeEmailHtml(formattedCheckOut) },
        {
          label: "Duration",
          value: escapeEmailHtml(`${numberOfNights} night${numberOfNights !== 1 ? "s" : ""}`),
        },
        { label: "Amount due (reference)", value: totalCell },
      ]
      const paymentNote = formalNoticeBox(
        `<p style="margin:0;font-size:14px;line-height:1.6;color:#334155;">Payment records are verified by the property. If you submitted proof of payment, please await separate confirmation that your payment has been received and applied.</p>`,
        { borderColor: "#94a3b8", bg: "#f8fafc" },
      )
      const approvedMain = `
        ${formalHeading("Reservation confirmed", 1)}
        ${formalParagraph(`Dear ${guestNameEsc},`)}
        ${formalParagraph(
          `We are pleased to confirm that your reservation request at <strong style="color:#18181b;">${brandNameHtml}</strong> has been <strong style="color:#18181b;">accepted</strong>. Please review the particulars below.`,
        )}
        ${formalDetailTable(approvedRows)}
        ${paymentNote}
        ${formalParagraph(
          `Should you require any amendment or have further questions, please reach out to the property directly using its published contact information.`,
        )}
        ${formalParagraph(`Yours sincerely,<br/><strong style="color:#18181b;">${brandNameHtml}</strong>`, "margin-top:28px;margin-bottom:0;")}
      `
      htmlContent = formalEmailShell({
        mainHtml: approvedMain,
        footerHtml: defaultBookingFooter(brandFooterEsc),
        accentColor: "#1e3a5f",
      })
      textContent = `Reservation confirmed — ${brandName}\n\nDear ${name || "Valued Guest"},\n\nYour reservation has been accepted.\n\nAccommodation: ${displayRoomName || "See property"}\nCheck-in: ${formattedCheckIn}\nCheck-out: ${formattedCheckOut}\nNights: ${numberOfNights}${totalAmount > 0 ? `\nTotal (reference): ₱${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}\n\nPayment is verified by the property; await confirmation if applicable.\n\n— ${brandName}`
    } else if (status === "Cancelled" || status === "Declined") {
      subject =
        status === "Cancelled"
          ? `Reservation cancelled — ${brandName}`
          : `Reservation declined — ${brandName}`
      const declineReason = status === "Declined" ? String(reason || "").trim() : ""
      const negativeTitle =
        status === "Cancelled" ? "Reservation cancelled" : "Reservation declined"
      const negativeLead =
        status === "Cancelled"
          ? `We write to inform you that your reservation detailed below has been <strong style="color:#18181b;">cancelled</strong>.`
          : `We regret that we are unable to accommodate your reservation request at this time. Your request has been <strong style="color:#18181b;">declined</strong>.`
      const declinedRows = [
        { label: "Booking reference", value: escapeEmailHtml(bookingId || "N/A") },
        { label: "Room", value: escapeEmailHtml(displayRoomName || roomType || "N/A") },
        { label: "Check-in", value: escapeEmailHtml(formattedCheckIn) },
        { label: "Check-out", value: escapeEmailHtml(formattedCheckOut) },
      ]
      const reasonBlock = declineReason
        ? formalNoticeBox(
            `<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#78716c;">Remarks</p><p style="margin:0;font-size:14px;line-height:1.65;color:#44403c;">${escapeHtml(declineReason)}</p>`,
            { borderColor: "#d6d3d1", bg: "#fafaf9" },
          )
        : ""
      const declinedMain = `
        ${formalHeading(negativeTitle, 1)}
        ${formalParagraph(`Dear ${guestNameEsc},`)}
        ${formalParagraph(negativeLead)}
        ${formalDetailTable(declinedRows)}
        ${reasonBlock}
        ${formalParagraph(
          `For alternative dates or further assistance, you may contact the property directly. We appreciate your understanding.`,
        )}
        ${formalParagraph(`Yours sincerely,<br/><strong style="color:#18181b;">${brandNameHtml}</strong>`, "margin-top:28px;margin-bottom:0;")}
      `
      htmlContent = formalEmailShell({
        mainHtml: declinedMain,
        footerHtml: defaultBookingFooter(brandFooterEsc),
        accentColor: status === "Cancelled" ? "#57534e" : "#7c2d12",
      })
      textContent = `Reservation ${status === "Cancelled" ? "cancelled" : "declined"} — ${brandName}\n\nDear ${name || "Valued Guest"},\n\n${status === "Cancelled" ? "Your reservation has been cancelled." : "Your reservation request has been declined."}\n\nBooking reference: ${bookingId || "N/A"}\nRoom: ${displayRoomName || roomType || "N/A"}\nCheck-in: ${formattedCheckIn}\nCheck-out: ${formattedCheckOut}${declineReason ? `\n\nRemarks: ${declineReason}` : ""}\n\n— ${brandName}`
    } else {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const mailOptions = {
      from: `"${getResortAdminMailDisplayName()}" <${fromUser}>`,
      to: email,
      subject: subject,
      html: htmlContent,
      text: textContent,
    }
    if (centralReplyTo) {
      mailOptions.replyTo = centralReplyTo
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)
    console.log("Status email sent:", info.messageId)

    // Return response with payment link status for debugging
    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
      mailSource,
      paymentLinkCreated: !!paymentLink,
      paymentLink: paymentLink || null,
      totalAmount: totalAmount,
      pricePerNight: pricePerNight,
      numberOfNights: numberOfNights,
      paymentError: paymentErrorDetails,
      debug: {
        hasSecretKey: !!process.env.PAYMONGO_SECRET_KEY,
        secretKeyFormat: process.env.PAYMONGO_SECRET_KEY ? (process.env.PAYMONGO_SECRET_KEY.startsWith("sk_") ? "correct" : "incorrect") : "missing",
        secretKeyPrefix: process.env.PAYMONGO_SECRET_KEY ? process.env.PAYMONGO_SECRET_KEY.substring(0, 10) + "..." : "not set",
      }
    })
  } catch (error) {
    console.error("Error sending status email:", error)
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    )
  }
}

