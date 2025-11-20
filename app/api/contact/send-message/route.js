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
    const { name, email, message } = await request.json()

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
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

    // Save contact message to Firestore
    let messageId
    try {
      const contactRef = collection(db, "contactMessages")
      const docRef = await addDoc(contactRef, {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
        status: "Unread", // Unread, Read, Replied
        createdAt: serverTimestamp(),
      })
      messageId = docRef.id
      console.log("Contact message saved:", { name, email, messageId })
    } catch (firestoreError) {
      console.error("Firestore error:", firestoreError)
      return NextResponse.json(
        { error: "Failed to save message", details: firestoreError.message },
        { status: 500 }
      )
    }

    // Send confirmation email to user
    try {
      const emailPassword = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS
      if (process.env.EMAIL_USER && emailPassword) {
        const transporter = createTransporter()
        
        // Verify transporter connection
        await transporter.verify()

        // Send confirmation email to user
        const userMailOptions = {
          from: `"LuxeStay" <${process.env.EMAIL_USER}>`,
          to: email.trim(),
          subject: "Thank You for Contacting LuxeStay",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
              <h2 style="color: #059669;">Thank You for Contacting Us!</h2>
              <p>Dear ${name.trim()},</p>
              <p>We have received your message and will get back to you as soon as possible.</p>
              <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #374151;"><strong>Your Message:</strong></p>
                <p style="margin: 10px 0 0 0; color: #6b7280; white-space: pre-wrap;">${message.trim()}</p>
              </div>
              <p>Our team typically responds within 24 hours. If your inquiry is urgent, please call us directly.</p>
              <p style="margin-top: 30px;">Best regards,<br/><strong>The LuxeStay Team</strong></p>
            </div>
          `,
          text: `Dear ${name.trim()},\n\nWe have received your message and will get back to you as soon as possible.\n\nYour Message:\n${message.trim()}\n\nOur team typically responds within 24 hours. If your inquiry is urgent, please call us directly.\n\nBest regards,\nThe LuxeStay Team`,
        }

        await transporter.sendMail(userMailOptions)
        console.log("Confirmation email sent to user:", email.trim())

        // Send notification email to admin
        const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER
        if (adminEmail) {
          const adminMailOptions = {
            from: `"LuxeStay Contact Form" <${process.env.EMAIL_USER}>`,
            to: adminEmail,
            subject: `New Contact Message from ${name.trim()}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
                <h2 style="color: #dc2626;">New Contact Message</h2>
                <p>You have received a new contact message from the website.</p>
                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0;"><strong>Name:</strong> ${name.trim()}</p>
                  <p style="margin: 8px 0;"><strong>Email:</strong> ${email.trim()}</p>
                  <p style="margin: 8px 0 0 0;"><strong>Message:</strong></p>
                  <p style="margin: 10px 0 0 0; color: #374151; white-space: pre-wrap;">${message.trim()}</p>
                </div>
                <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">Message ID: ${messageId}</p>
                <p style="margin-top: 10px;">
                  <a href="${process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000/admin'}" style="display: inline-block; background-color: #059669; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">View in Admin Panel</a>
                </p>
              </div>
            `,
            text: `New Contact Message\n\nName: ${name.trim()}\nEmail: ${email.trim()}\n\nMessage:\n${message.trim()}\n\nMessage ID: ${messageId}`,
          }

          await transporter.sendMail(adminMailOptions)
          console.log("Notification email sent to admin:", adminEmail)
        }
      }
    } catch (emailError) {
      // Don't fail the request if email fails - message is already saved
      console.error("Error sending email:", emailError)
      // Continue - message is saved to Firestore
    }

    return NextResponse.json({
      success: true,
      message: "Message sent successfully",
    })
  } catch (error) {
    console.error("Error processing contact message:", error)
    return NextResponse.json(
      { error: "Failed to process message", details: error.message },
      { status: 500 }
    )
  }
}

