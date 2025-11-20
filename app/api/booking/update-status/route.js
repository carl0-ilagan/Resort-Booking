import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { doc, updateDoc, serverTimestamp } from "firebase/firestore"

export async function POST(request) {
  try {
    const { bookingId, status } = await request.json()

    console.log("Update status request:", { bookingId, status })

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: "Booking ID and status are required" },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ["Pending", "Approved", "Cancelled", "Declined", "Completed"]
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      )
    }

    // Check if db is initialized
    if (!db) {
      console.error("Firebase db is not initialized")
      return NextResponse.json(
        { error: "Database not initialized" },
        { status: 500 }
      )
    }

    // Update booking status in Firestore
    const bookingRef = doc(db, "guestbooking", bookingId)
    console.log("Updating booking:", bookingId, "to status:", status.trim())

    try {
      await updateDoc(bookingRef, {
        status: status.trim(), // Trim to handle "Approved " with trailing space
        updatedAt: serverTimestamp(),
      })

      console.log(`✅ Booking ${bookingId} status updated to: ${status.trim()}`)

      return NextResponse.json({
        success: true,
        message: `Booking status updated to ${status.trim()}`,
      })
    } catch (firestoreError) {
      console.error("❌ Firestore update error:", {
        code: firestoreError.code,
        message: firestoreError.message,
        stack: firestoreError.stack,
      })
      
      // Provide more specific error messages
      let errorMessage = "Failed to update booking status"
      if (firestoreError.code === "permission-denied") {
        errorMessage = "Permission denied. Please check Firestore security rules."
      } else if (firestoreError.code === "not-found") {
        errorMessage = "Booking not found."
      } else if (firestoreError.message) {
        errorMessage = firestoreError.message
      }

      return NextResponse.json(
        { 
          error: errorMessage, 
          details: firestoreError.message,
          code: firestoreError.code 
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error("❌ Error updating booking status:", {
      message: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      { error: "Failed to update booking status", details: error.message },
      { status: 500 }
    )
  }
}

