import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

// Create transporter function (reuse from send-otp)
function createTransporter() {
  const emailUser = process.env.EMAIL_USER
  const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials not configured")
  }

  try {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    })
  } catch (error) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
    })
  }
}

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
async function getRoomData(roomType) {
  try {
    const roomsRef = collection(db, "rooms")
    const allRoomsSnapshot = await getDocs(roomsRef)
    
    if (allRoomsSnapshot.empty) {
      console.warn("No rooms found in Firestore")
      return { name: null, price: 0 }
    }

    // If roomType is provided and not empty/WALA, try to match
    if (roomType && roomType.trim() && roomType.trim() !== "WALA") {
      const trimmedRoomType = roomType.trim()
      console.log(`Searching for room: "${trimmedRoomType}"`)
      
      // Log all available room types and names for debugging
      const availableRooms = allRoomsSnapshot.docs.map(doc => {
        const data = doc.data()
        return { id: doc.id, type: data.type, name: data.name, price: data.price }
      })
      console.log("Available rooms:", JSON.stringify(availableRooms, null, 2))

      // Try exact match by type (case-insensitive)
      let matchedRoom = allRoomsSnapshot.docs.find(doc => {
        const data = doc.data()
        return data.type?.trim().toLowerCase() === trimmedRoomType.toLowerCase()
      })

      // If no match by type, try exact match by name (case-insensitive)
      if (!matchedRoom) {
        matchedRoom = allRoomsSnapshot.docs.find(doc => {
          const data = doc.data()
          return data.name?.trim().toLowerCase() === trimmedRoomType.toLowerCase()
        })
      }

      // If still no match, try partial match (contains)
      if (!matchedRoom) {
        matchedRoom = allRoomsSnapshot.docs.find(doc => {
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
    const availableRoom = allRoomsSnapshot.docs.find(doc => {
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
async function getRoomPrice(roomType) {
  const roomData = await getRoomData(roomType)
  return roomData.price
}

export async function POST(request) {
  try {
    let { email, name, roomType, checkIn, checkOut, status, bookingId } = await request.json()

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

    // Check if email credentials are configured
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
    if (!process.env.EMAIL_USER || !emailPassword) {
      console.error("Email credentials not configured")
      return NextResponse.json(
        { error: "Email service not configured" },
        { status: 500 }
      )
    }

    const transporter = createTransporter()

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
        const roomData = await getRoomData(roomType)
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
        const roomData = await getRoomData(roomType)
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
      
      // Create PayMongo payment link if amount is valid
      if (totalAmount > 0) {
        console.log("Creating PayMongo payment link...")
        try {
          // Import the payment creation function directly instead of making HTTP call
          const { createPaymongoLink } = await import("@/app/api/payment/create-paymongo-link/route")
          
          // Create payment link using PayMongo API
          const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY
          if (paymongoSecretKey) {
            const amountInCentavos = Math.round(totalAmount * 100)
            const authString = Buffer.from(paymongoSecretKey + ":").toString("base64")
            
            const paymongoResponse = await fetch("https://api.paymongo.com/v1/links", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Basic ${authString}`,
              },
              body: JSON.stringify({
                data: {
                  attributes: {
                    amount: amountInCentavos,
                    currency: "PHP",
                    description: `Booking Payment - ${displayRoomName || roomType || "Room"} (${checkIn} to ${checkOut})`,
                    remarks: `Booking ID: ${bookingId}`,
                  },
                },
              }),
            })
            
            const paymongoData = await paymongoResponse.json()
            
            if (paymongoResponse.ok && paymongoData.data?.attributes?.checkout_url) {
              paymentLink = paymongoData.data.attributes.checkout_url
              const paymentLinkId = paymongoData.data?.id
              console.log("Payment link created:", paymentLink, "Link ID:", paymentLinkId)
              
              // Store payment link ID in booking
              if (bookingId && paymentLinkId) {
                try {
                  const { doc, updateDoc } = await import("firebase/firestore")
                  const bookingRef = doc(db, "guestbooking", bookingId)
                  await updateDoc(bookingRef, {
                    paymentLinkId: paymentLinkId,
                    paymentLink: paymentLink,
                  })
                  console.log(`Payment link ID stored for booking ${bookingId}`)
                } catch (updateError) {
                  console.error("Error storing payment link ID:", updateError)
                  // Continue even if storing fails
                }
              }
            } else {
              console.error("Failed to create payment link:", paymongoData.errors?.[0]?.detail || "Unknown error")
              console.error("PayMongo response:", JSON.stringify(paymongoData, null, 2))
            }
          } else {
            console.error("PayMongo secret key not configured")
          }
        } catch (paymentError) {
          console.error("Error creating payment link:", paymentError)
          console.error("Payment error details:", {
            message: paymentError.message,
            stack: paymentError.stack,
          })
          // Continue without payment link - booking is still approved
        }
      } else {
        console.warn(`Cannot create payment link: totalAmount is ${totalAmount} (pricePerNight: ${pricePerNight}, nights: ${numberOfNights})`)
      }
    } else {
      console.warn("Cannot create payment link: missing required fields", {
        status,
        roomType,
        checkIn,
        checkOut,
      })
    }

    // Email content based on status
    let subject, htmlContent, textContent

    if (status === "Approved") {
      subject = "🎉 Your Booking Has Been Approved - LuxeStay"
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #059669; font-size: 28px; margin: 0;">✅ Booking Approved!</h1>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear ${name || "Valued Guest"},</p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We are delighted to inform you that your booking has been <strong style="color: #059669;">approved</strong>!
            </p>
            
            <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h2 style="color: #059669; margin-top: 0; font-size: 18px;">Booking Details</h2>
              <ul style="list-style: none; padding: 0; margin: 0; color: #374151;">
                <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>Room:</strong> ${displayRoomName && displayRoomName !== "N/A" ? displayRoomName : "N/A - Please contact us"}
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>Check-in:</strong> ${formattedCheckIn}
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>Check-out:</strong> ${formattedCheckOut}
                </li>
                <li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                  <strong>Nights:</strong> ${numberOfNights} night${numberOfNights !== 1 ? "s" : ""}
                </li>
                ${totalAmount > 0 ? `
                <li style="padding: 8px 0;">
                  <strong>Total:</strong> <span style="font-size: 20px; color: #059669; font-weight: bold;">₱${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </li>
                ` : `
                <li style="padding: 8px 0; color: #dc2626;">
                  <strong>Total:</strong> <span style="font-size: 16px; color: #dc2626;">Price not available. Please contact us for payment details.</span>
                </li>
                `}
              </ul>
            </div>
            
            ${paymentLink ? `
            <div style="text-align: center; margin: 30px 0; padding: 25px; background-color: #f0fdf4; border: 2px solid #059669; border-radius: 8px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 20px; font-weight: 600;">
                💳 Click the button below to pay via GCash or other payment methods:
              </p>
              <a href="${paymentLink}" target="_blank" style="display: inline-block; padding: 16px 40px; background: linear-gradient(135deg, #00AAFF 0%, #0088CC 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 6px rgba(0, 170, 255, 0.3); transition: all 0.3s ease;">Pay Now - ₱${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</a>
              <p style="color: #6b7280; font-size: 12px; margin-top: 15px; margin-bottom: 0;">
                Secure payment powered by PayMongo
              </p>
            </div>
            ` : totalAmount > 0 ? `
            <div style="text-align: center; margin: 30px 0; padding: 20px; background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px;">
              <p style="color: #92400e; font-size: 14px; line-height: 1.6; margin: 0; font-weight: 600;">
                ⏳ Payment link is being generated. Please contact us if you don't receive it shortly.
              </p>
            </div>
            ` : ""}
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We look forward to welcoming you! If you have any questions or special requests, please don't hesitate to contact us.
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 30px;">
              Best regards,<br>
              <strong>The LuxeStay Team</strong>
            </p>
          </div>
        </div>
      `
      textContent = `Your booking has been approved!\n\nBooking Details:\n- Room: ${displayRoomName || "N/A"}\n- Check-in: ${formattedCheckIn}\n- Check-out: ${formattedCheckOut}${totalAmount > 0 ? `\n- Nights: ${numberOfNights} night${numberOfNights !== 1 ? "s" : ""}\n- Total: ₱${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ""}${paymentLink ? `\n\n💳 Payment Link: ${paymentLink}\n\nClick the link above to pay via GCash or other payment methods.` : ""}\n\nWe look forward to welcoming you!`
    } else if (status === "Cancelled" || status === "Declined") {
      subject = "Booking Update - LuxeStay"
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #dc2626; font-size: 28px; margin: 0;">Booking ${status === "Cancelled" ? "Cancelled" : "Declined"}</h1>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear ${name || "Valued Guest"},</p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              We regret to inform you that your booking has been <strong style="color: #dc2626;">${status === "Cancelled" ? "cancelled" : "declined"}</strong>.
            </p>
            
            <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h2 style="color: #dc2626; margin-top: 0; font-size: 18px;">Booking Details</h2>
              <table style="width: 100%; color: #374151;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Booking ID:</td>
                  <td style="padding: 8px 0;">${bookingId || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Room Type:</td>
                  <td style="padding: 8px 0;">${displayRoomName || roomType || "N/A"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Check-in:</td>
                  <td style="padding: 8px 0;">${formattedCheckIn}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Check-out:</td>
                  <td style="padding: 8px 0;">${formattedCheckOut}</td>
                </tr>
              </table>
            </div>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6;">
              If you have any questions or would like to make a new booking, please contact us. We apologize for any inconvenience.
            </p>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-top: 30px;">
              Best regards,<br>
              <strong>The LuxeStay Team</strong>
            </p>
          </div>
        </div>
      `
      textContent = `Your booking has been ${status === "Cancelled" ? "cancelled" : "declined"}.\n\nBooking Details:\n- Booking ID: ${bookingId || "N/A"}\n- Room Type: ${displayRoomName || roomType || "N/A"}\n- Check-in: ${formattedCheckIn}\n- Check-out: ${formattedCheckOut}\n\nIf you have any questions, please contact us.`
    } else {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    const mailOptions = {
      from: `"LuxeStay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
      text: textContent,
    }

    // Verify transporter connection
    try {
      await transporter.verify()
    } catch (verifyError) {
      console.error("Transporter verification failed:", verifyError)
      return NextResponse.json(
        { error: "Email service connection failed" },
        { status: 500 }
      )
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)
    console.log("Status email sent:", info.messageId)

    return NextResponse.json({
      success: true,
      message: "Email sent successfully",
    })
  } catch (error) {
    console.error("Error sending status email:", error)
    return NextResponse.json(
      { error: "Failed to send email", details: error.message },
      { status: 500 }
    )
  }
}

