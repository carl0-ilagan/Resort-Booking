import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp } from "firebase/firestore"

/**
 * Auto-complete bookings that are:
 * - Status: "Approved"
 * - Payment Status: "paid"
 * - Check-out date has passed
 */
export async function POST(request) {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Get all approved bookings (filter by paymentStatus in code to avoid composite index requirement)
    const bookingsRef = collection(db, "guestbooking")
    let q
    
    try {
      // Try querying with both conditions (requires composite index)
      q = query(
        bookingsRef,
        where("status", "==", "Approved"),
        where("paymentStatus", "==", "paid")
      )
    } catch (error) {
      // Fallback: query only by status, filter paymentStatus in code
      console.warn("Composite index not available, using fallback query")
      q = query(bookingsRef, where("status", "==", "Approved"))
    }

    const querySnapshot = await getDocs(q)
    const bookingsToComplete = []

    // Check each booking
    for (const bookingDoc of querySnapshot.docs) {
      const bookingData = bookingDoc.data()
      const bookingId = bookingDoc.id

      // Skip if not paid
      if (bookingData.paymentStatus !== "paid") continue

      if (!bookingData.checkOut) continue

      // Parse check-out date
      const checkOutDate = new Date(bookingData.checkOut + "T00:00:00")
      checkOutDate.setHours(0, 0, 0, 0)

      // If check-out date has passed, mark for completion
      if (checkOutDate < today) {
        bookingsToComplete.push({
          id: bookingId,
          checkOut: bookingData.checkOut,
          name: bookingData.name,
        })
      }
    }

    // Update all eligible bookings to "Completed"
    const updatePromises = bookingsToComplete.map(async (booking) => {
      try {
        const bookingRef = doc(db, "guestbooking", booking.id)
        await updateDoc(bookingRef, {
          status: "Completed",
          updatedAt: serverTimestamp(),
        })
        console.log(`✅ Auto-completed booking ${booking.id} (${booking.name}) - Check-out: ${booking.checkOut}`)
        return { id: booking.id, success: true }
      } catch (error) {
        console.error(`❌ Error auto-completing booking ${booking.id}:`, error)
        return { id: booking.id, success: false, error: error.message }
      }
    })

    const results = await Promise.all(updatePromises)
    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: `Auto-completed ${successful} booking(s)`,
      completed: successful,
      failed: failed,
      total: bookingsToComplete.length,
      details: results,
    })
  } catch (error) {
    console.error("Error in auto-complete function:", error)
    return NextResponse.json(
      { error: "Failed to auto-complete bookings", details: error.message },
      { status: 500 }
    )
  }
}

// Also allow GET for manual triggering
export async function GET() {
  return POST(new Request("http://localhost", { method: "POST" }))
}

