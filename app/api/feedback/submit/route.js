import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, addDoc, serverTimestamp } from "firebase/firestore"
import nodemailer from "nodemailer"

// Create transporter function
function createTransporter() {
  const emailUser = process.env.EMAIL_USER
  const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS

  if (!emailUser || !emailPassword) {
    throw new Error("Email credentials not configured. Please set EMAIL_USER and EMAIL_PASSWORD (or EMAIL_PASS) in .env.local")
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

export async function POST(request) {
  try {
    const { name, email, rating, message } = await request.json()

    // Validate required fields
    if (!name || !email || !message || !rating) {
      return NextResponse.json(
        { error: "Name, email, rating, and message are required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    // Validate rating
    const ratingNum = Number.parseInt(rating)
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      )
    }

    // Save feedback to Firestore
    let feedbackId
    try {
      const feedbackRef = collection(db, "feedbacks")
      const docRef = await addDoc(feedbackRef, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        rating: ratingNum,
        message: message.trim(),
        status: "Published", // Published, Pending, Hidden
        createdAt: serverTimestamp(),
      })
      feedbackId = docRef.id
      console.log("Feedback saved:", { name, email, rating: ratingNum, feedbackId })
    } catch (firestoreError) {
      console.error("Firestore error:", firestoreError)
      return NextResponse.json(
        { error: "Failed to save feedback", details: firestoreError.message },
        { status: 500 }
      )
    }

    // Send notification email to admin
    try {
      const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
      if (process.env.EMAIL_USER && emailPassword) {
        const transporter = createTransporter()
        
        // Verify transporter connection
        await transporter.verify()

        // Send notification email to admin
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER
        if (adminEmail) {
          const stars = "⭐".repeat(ratingNum)
          const adminMailOptions = {
            from: `"LuxeStay Feedback" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: `New Guest Feedback - ${ratingNum} Star${ratingNum !== 1 ? "s" : ""} Rating`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #059669;">New Guest Feedback Received</h2>
                <p>You have received a new feedback submission from your website.</p>
                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0;"><strong>Name:</strong> ${name.trim()}</p>
                  <p style="margin: 8px 0;"><strong>Email:</strong> ${email.trim()}</p>
                  <p style="margin: 8px 0;"><strong>Rating:</strong> ${stars} (${ratingNum}/5)</p>
                  <p style="margin: 8px 0 0 0;"><strong>Feedback:</strong></p>
                  <p style="margin: 10px 0 0 0; color: #374151; white-space: pre-wrap;">${message.trim()}</p>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">Feedback ID: ${feedbackId}</p>
                <p style="margin-top: 10px;">
                  <a href="${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000/admin'}" style="display: inline-block; background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View in Admin Panel</a>
                </p>
              </div>
            `,
            text: `New Guest Feedback\n\nName: ${name.trim()}\nEmail: ${email.trim()}\nRating: ${ratingNum}/5\n\nFeedback:\n${message.trim()}\n\nFeedback ID: ${feedbackId}`,
          }

          await transporter.sendMail(adminMailOptions)
          console.log("Feedback notification email sent to admin:", adminEmail)
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails - feedback is already saved
      console.error("Error sending email:", emailError)
      // Continue - feedback is saved to Firestore
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
    })
  } catch (error) {
    console.error("Error processing feedback:", error)
    return NextResponse.json(
      { error: "Failed to process feedback", details: error.message },
      { status: 500 }
    )
  }
}

