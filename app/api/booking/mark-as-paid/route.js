import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore"

export async function POST(request) {
  try {
    const { bookingId, paidAmount } = await request.json()

    if (!bookingId) {
      return NextResponse.json(
        { error: "Booking ID is required" },
        { status: 400 }
      )
    }

    const bookingRef = doc(db, "guestbooking", bookingId)
    const bookingDoc = await getDoc(bookingRef)

    if (!bookingDoc.exists()) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      )
    }

    const bookingData = bookingDoc.data()

    // Calculate amount if not provided
    let finalPaidAmount = paidAmount
    if (!finalPaidAmount || finalPaidAmount === 0) {
      // Try to get from booking data
      if (bookingData.pricePerNight && bookingData.checkIn && bookingData.checkOut) {
        const checkIn = new Date(bookingData.checkIn + "T00:00:00")
        const checkOut = new Date(bookingData.checkOut + "T00:00:00")
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
        finalPaidAmount = bookingData.pricePerNight * nights
      } else if (bookingData.totalPrice) {
        finalPaidAmount = bookingData.totalPrice
      }
    }

    // Update booking with payment information
    const updateData = {
      paymentStatus: "paid",
      paidAmount: finalPaidAmount || 0,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await updateDoc(bookingRef, updateData)

    console.log(`✅ Booking ${bookingId} marked as paid. Amount: ₱${finalPaidAmount || 0}`)

    return NextResponse.json({
      success: true,
      message: "Booking marked as paid successfully",
      bookingId: bookingId,
      paidAmount: finalPaidAmount || 0,
    })
  } catch (error) {
    console.error("Error marking booking as paid:", error)
    return NextResponse.json(
      { error: "Failed to mark booking as paid", details: error.message },
      { status: 500 }
    )
  }
}

