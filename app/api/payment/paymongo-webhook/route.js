import { NextResponse } from "next/server"
import crypto from "crypto"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, getDoc, updateDoc, doc, serverTimestamp } from "firebase/firestore"

// Verify PayMongo webhook signature
function verifySignature(payload, signature, secret) {
  try {
    const hmac = crypto.createHmac("sha256", secret)
    hmac.update(payload)
    const computedSignature = hmac.digest("hex")
    return computedSignature === signature
  } catch (error) {
    console.error("Error verifying signature:", error)
    return false
  }
}

export async function POST(request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get("paymongo-signature")

    if (!signature) {
      console.error("Missing PayMongo signature header")
      return NextResponse.json({ error: "Missing signature" }, { status: 401 })
    }

    // Get webhook secret from environment
    const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("PayMongo webhook secret not configured")
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })
    }

    // Verify signature
    if (!verifySignature(rawBody, signature, webhookSecret)) {
      console.error("Invalid PayMongo signature")
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    // Parse webhook payload
    const event = JSON.parse(rawBody)

    console.log("PayMongo webhook received:", event.type)

    // Handle payment.paid event
    if (event.type === "payment.paid") {
      const paymentData = event.data
      const paymentAttributes = paymentData.attributes

      console.log("Payment paid event received:", JSON.stringify(paymentData, null, 2))

      // Get payment link ID from the payment source
      // PayMongo webhook structure for payment.paid: event.data.relationships.source.data.id
      let paymentLinkId = null
      
      // Try different possible structures based on PayMongo API
      if (paymentData.relationships?.source?.data?.id) {
        paymentLinkId = paymentData.relationships.source.data.id
      } else if (paymentAttributes.source?.id) {
        paymentLinkId = paymentAttributes.source.id
      } else if (paymentAttributes.data?.id) {
        paymentLinkId = paymentAttributes.data.id
      }

      // Get payment amount (convert from centavos to pesos)
      const amountInCentavos = paymentAttributes.amount || paymentData.attributes?.amount || 0
      const amountInPesos = amountInCentavos / 100

      // Find booking by payment link ID or remarks
      // For payment links, we need to fetch the link to get remarks
      let bookingId = null

      // First try to find by payment link ID
      if (paymentLinkId) {
        try {
          const bookingsRef = collection(db, "guestbooking")
          const q = query(bookingsRef, where("paymentLinkId", "==", paymentLinkId))
          const querySnapshot = await getDocs(q)
          
          if (!querySnapshot.empty) {
            bookingId = querySnapshot.docs[0].id
            console.log(`Found booking ${bookingId} by payment link ID: ${paymentLinkId}`)
          }
        } catch (queryError) {
          console.error("Error querying by payment link ID:", queryError)
        }
      }

      // If not found, try to fetch payment link from PayMongo to get remarks
      if (!bookingId && paymentLinkId) {
        try {
          const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY
          if (paymongoSecretKey) {
            const authString = Buffer.from(paymongoSecretKey + ":").toString("base64")
            const linkResponse = await fetch(`https://api.paymongo.com/v1/links/${paymentLinkId}`, {
              headers: {
                Authorization: `Basic ${authString}`,
              },
            })
            
            if (linkResponse.ok) {
              const linkData = await linkResponse.json()
              const remarks = linkData.data?.attributes?.remarks
              
              if (remarks) {
                const match = remarks.match(/Booking ID:\s*([^\s]+)/i)
                if (match) {
                  bookingId = match[1]
                  console.log(`Found booking ID from payment link remarks: ${bookingId}`)
                }
              }
            }
          }
        } catch (fetchError) {
          console.error("Error fetching payment link:", fetchError)
        }
      }

      // Last resort: try to extract from payment attributes remarks if available
      if (!bookingId) {
        const remarks = paymentAttributes.remarks
        if (remarks) {
          const match = remarks.match(/Booking ID:\s*([^\s]+)/i)
          if (match) {
            bookingId = match[1]
            console.log(`Found booking ID from payment remarks: ${bookingId}`)
          }
        }
      }

      if (!bookingId) {
        console.error("Booking ID not found. Payment link ID:", paymentLinkId, "Amount:", amountInPesos)
        return NextResponse.json({ error: "Booking ID not found" }, { status: 400 })
      }

      // Update booking in Firestore
      try {
        const bookingDocRef = doc(db, "guestbooking", bookingId)

        // Get booking data to check current status and check-out date
        const bookingDoc = await getDoc(bookingDocRef)
        const bookingData = bookingDoc.exists() ? bookingDoc.data() : null

        // Update booking with payment information
        const updateData = {
          paymentStatus: "paid",
          paymentId: paymentData.id,
          paymentLinkId: paymentLinkId,
          paidAmount: amountInPesos,
          paidAt: serverTimestamp(),
        }

        // Check if booking check-out date has passed, auto-complete if so
        if (bookingData?.checkOut && bookingData.status?.trim() === "Approved") {
          const checkOutDate = new Date(bookingData.checkOut + "T00:00:00")
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          if (checkOutDate < today) {
            updateData.status = "Completed"
            updateData.updatedAt = serverTimestamp()
            console.log(`✅ Booking ${bookingId} will be auto-completed (check-out date passed)`)
          }
        }

        await updateDoc(bookingDocRef, updateData)

        console.log(`✅ Booking ${bookingId} marked as paid. Amount: ₱${amountInPesos}`)

        return NextResponse.json({ 
          success: true, 
          message: "Payment recorded successfully",
          bookingId: bookingId,
          amount: amountInPesos
        })
      } catch (firestoreError) {
        console.error("Error updating booking in Firestore:", firestoreError)
        return NextResponse.json(
          { error: "Failed to update booking", details: firestoreError.message },
          { status: 500 }
        )
      }
    }

    // Handle other event types if needed
    console.log(`Unhandled event type: ${event.type}`)
    return NextResponse.json({ message: "Event received but not processed" })
  } catch (error) {
    console.error("Error processing PayMongo webhook:", error)
    return NextResponse.json(
      { error: "Failed to process webhook", details: error.message },
      { status: 500 }
    )
  }
}

