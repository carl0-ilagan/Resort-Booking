import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore"
import { otpStore } from "@/lib/otp-store"
import nodemailer from "nodemailer"

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
    let { name, email, phone, checkIn, checkOut, guests, roomType, specialRequests, otp } = await request.json()

    // Normalize email: trim whitespace and convert to lowercase
    email = email ? email.trim().toLowerCase() : ""

    // Validate required fields
    if (!name || !email || !phone || !checkIn || !checkOut || !guests || !roomType || !otp) {
      return NextResponse.json(
        { error: "All required fields must be filled" },
        { status: 400 }
      )
    }

    // Check booking limit for this email
    try {
      const bookingsRef = collection(db, "guestbooking")
      const q = query(bookingsRef, where("email", "==", email))
      const querySnapshot = await getDocs(q)
      const existingBookingsCount = querySnapshot.size

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
    console.log("OTP store entries:", Array.from(otpStore.entries()).map(([e, d]) => ({ email: e, otp: d.otp, expiresAt: new Date(d.expiresAt).toISOString() })))

    // Verify OTP
    const storedData = otpStore.get(email)
    
    console.log("Stored data for email:", storedData ? { otp: storedData.otp, expiresAt: new Date(storedData.expiresAt).toISOString(), isExpired: storedData.expiresAt < Date.now() } : "NOT FOUND")
    
    if (!storedData) {
      console.error("OTP not found for email:", email)
      console.error("Available emails in store:", Array.from(otpStore.keys()))
      return NextResponse.json(
        { 
          error: "OTP not found. Please request a new OTP.",
          debug: process.env.NODE_ENV === "development" ? {
            lookupEmail: email,
            availableEmails: Array.from(otpStore.keys())
          } : undefined
        },
        { status: 400 }
      )
    }

    if (storedData.expiresAt < Date.now()) {
      otpStore.delete(email)
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
      
      console.log(`Verifying OTP - Found ${querySnapshot.size} bookings for room type: "${trimmedRoomType}"`)
      
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
        totalBookings: querySnapshot.size,
      })
      
      // Check for date overlaps (only for APPROVED bookings)
      const hasConflict = querySnapshot.docs.some((doc) => {
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
      createdAt: serverTimestamp(),
      verifiedAt: serverTimestamp(),
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
      otpStore.delete(email)

      // Send email notification to admin
      try {
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER
        if (adminEmail) {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS,
            },
          })

          const formatDate = (dateString) => {
            if (!dateString) return "N/A"
            try {
              const date = new Date(dateString + "T00:00:00")
              return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            } catch {
              return dateString
            }
          }

          const mailOptions = {
            from: `"LuxeStay Booking System" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: `🔔 New Booking Request - ${name}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
                <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <div style="text-align: center; margin-bottom: 30px;">
                    <h1 style="color: #059669; font-size: 28px; margin: 0;">📋 New Booking Request</h1>
                  </div>
                  
                  <p style="color: #374151; font-size: 16px; line-height: 1.6;">
                    A new booking has been submitted and is pending your approval.
                  </p>
                  
                  <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 20px; margin: 20px 0; border-radius: 4px;">
                    <h2 style="color: #059669; margin-top: 0; font-size: 18px;">Booking Details</h2>
                    <table style="width: 100%; color: #374151;">
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold; width: 40%;">Booking ID:</td>
                        <td style="padding: 8px 0;">${docRef.id}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Guest Name:</td>
                        <td style="padding: 8px 0;">${name}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                        <td style="padding: 8px 0;">${email}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Phone:</td>
                        <td style="padding: 8px 0;">${phone}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Room Type:</td>
                        <td style="padding: 8px 0;">${roomType}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Check-in:</td>
                        <td style="padding: 8px 0;">${formatDate(checkIn)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Check-out:</td>
                        <td style="padding: 8px 0;">${formatDate(checkOut)}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Guests:</td>
                        <td style="padding: 8px 0;">${guests}</td>
                      </tr>
                      ${specialRequests ? `
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Special Requests:</td>
                        <td style="padding: 8px 0;">${specialRequests}</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                        <td style="padding: 8px 0;"><strong style="color: #f59e0b;">Pending</strong></td>
                      </tr>
                    </table>
                  </div>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <p style="color: #374151; font-size: 14px; line-height: 1.6;">
                      Please review and approve this booking in the admin dashboard.
                    </p>
                  </div>
                  
                  <p style="color: #374151; font-size: 14px; line-height: 1.6; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
                    This is an automated notification from the LuxeStay Booking System.
                  </p>
                </div>
              </div>
            `,
            text: `New Booking Request\n\nBooking ID: ${docRef.id}\nGuest Name: ${name}\nEmail: ${email}\nPhone: ${phone}\nRoom Type: ${roomType}\nCheck-in: ${formatDate(checkIn)}\nCheck-out: ${formatDate(checkOut)}\nGuests: ${guests}${specialRequests ? `\nSpecial Requests: ${specialRequests}` : ""}\nStatus: Pending\n\nPlease review and approve this booking in the admin dashboard.`,
          }

          await transporter.sendMail(mailOptions)
          console.log("Admin notification email sent successfully")
        }
      } catch (emailError) {
        console.error("Error sending admin notification email:", emailError)
        // Don't fail the booking if email fails
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

