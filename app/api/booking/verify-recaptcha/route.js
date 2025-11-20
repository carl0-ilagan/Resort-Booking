import { NextResponse } from "next/server"

export async function POST(request) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json(
        { error: "reCAPTCHA token is required" },
        { status: 400 }
      )
    }

    // Verify reCAPTCHA with Google
    const secretKey = process.env.RECAPTCHA_SECRET_KEY
    
    if (!secretKey) {
      console.warn("RECAPTCHA_SECRET_KEY not set, skipping verification (development mode)")
      // In development, allow if using test key
      if (token === "test-token" || token.includes("test")) {
        return NextResponse.json({ success: true })
      }
      return NextResponse.json(
        { error: "reCAPTCHA not configured" },
        { status: 500 }
      )
    }

    const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${token}`
    
    const response = await fetch(verifyUrl, {
      method: "POST",
    })

    const data = await response.json()

    if (data.success) {
      return NextResponse.json({ success: true })
    } else {
      console.error("reCAPTCHA verification failed:", data["error-codes"])
      return NextResponse.json(
        { 
          error: "reCAPTCHA verification failed",
          details: data["error-codes"]
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Error verifying reCAPTCHA:", error)
    return NextResponse.json(
      { error: "Failed to verify reCAPTCHA. Please try again." },
      { status: 500 }
    )
  }
}

