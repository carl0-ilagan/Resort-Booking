import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { otpStore } from "@/lib/otp-store"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

const MAX_BOOKINGS_PER_EMAIL = 3

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// Create transporter function to handle errors better
function createTransporter() {
  const emailUser = process.env.EMAIL_USER
  // Support both EMAIL_PASSWORD and EMAIL_PASS
  const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD (or EMAIL_PASS) in .env.local")
  }

  // Try Gmail service first, fallback to explicit SMTP
  try {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    })
  } catch (error) {
    // Fallback to explicit SMTP configuration
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false, // true for 465, false for other ports
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

export async function POST(request) {
  try {
    let { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    // Normalize email: trim whitespace and convert to lowercase
    email = email.trim().toLowerCase()

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    // Check booking limit for this email before sending OTP
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
      // Continue with OTP sending if limit check fails (don't block legitimate requests)
    }

    // Check if email credentials are configured (support both EMAIL_PASSWORD and EMAIL_PASS)
    const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
    if (!process.env.EMAIL_USER || !emailPassword) {
      console.error("Email credentials not configured")
      return NextResponse.json(
        { 
          error: "Email service not configured. Please contact administrator.",
          details: "EMAIL_USER and EMAIL_PASSWORD (or EMAIL_PASS) must be set in .env.local"
        },
        { status: 500 }
      )
    }

    // Create transporter
    let transporter
    try {
      transporter = createTransporter()
    } catch (transporterError) {
      console.error("Error creating transporter:", transporterError)
      return NextResponse.json(
        { 
          error: "Email service configuration error",
          details: transporterError.message
        },
        { status: 500 }
      )
    }

    // Generate OTP
    const otp = generateOTP()
    
    // Store OTP with expiration (5 minutes)
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
    otpStore.set(email, {
      otp,
      expiresAt,
    })

    // Debug logging
    console.log("OTP stored for email:", email)
    console.log("OTP code:", otp)
    console.log("OTP expires at:", new Date(expiresAt).toISOString())
    console.log("OTP store size:", otpStore.size)
    console.log("OTP store keys:", Array.from(otpStore.keys()))
    console.log("OTP store entries:", Array.from(otpStore.entries()).map(([e, d]) => ({ email: e, otp: d.otp, expiresAt: new Date(d.expiresAt).toISOString() })))

    // Email content
    const mailOptions = {
      from: `"LuxeStay" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Your OTP Verification Code - LuxeStay Booking",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #059669;">LuxeStay Booking Verification</h2>
          <p>Thank you for booking with us! Please use the following OTP code to verify your booking:</p>
          <div style="background-color: #f0fdf4; border: 2px solid #059669; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h1 style="color: #059669; font-size: 32px; letter-spacing: 8px; margin: 0;">${otp}</h1>
          </div>
          <p style="color: #666;">This code will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
      text: `Your OTP verification code is: ${otp}. This code will expire in 5 minutes.`,
    }

    // Verify transporter connection first
    try {
      await transporter.verify()
    } catch (verifyError) {
      console.error("Transporter verification failed:", verifyError)
      return NextResponse.json(
        { 
          error: "Email service connection failed",
          details: verifyError.message || "Please check your email credentials in .env.local"
        },
        { status: 500 }
      )
    }

    // Send email
    const info = await transporter.sendMail(mailOptions)
    console.log("OTP email sent:", info.messageId)

    return NextResponse.json({ 
      success: true, 
      message: "OTP sent successfully" 
    })
  } catch (error) {
    console.error("Error sending OTP:", error)
    
    // Provide more detailed error message
    let errorMessage = "Failed to send OTP. Please try again."
    if (error.message) {
      errorMessage += ` Error: ${error.message}`
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

