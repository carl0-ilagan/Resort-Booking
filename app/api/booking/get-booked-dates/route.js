import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

// Helper function to parse date consistently
function parseDate(dateValue) {
  if (!dateValue) return null
  
  if (dateValue?.toDate) {
    return dateValue.toDate()
  }
  
  if (dateValue?.seconds) {
    return new Date(dateValue.seconds * 1000)
  }
  
  if (typeof dateValue === "string") {
    // Ensure date string is treated as UTC to avoid timezone issues
    return new Date(dateValue + "T00:00:00Z")
  }
  
  return new Date(dateValue)
}

export async function POST(request) {
  try {
    const { roomType } = await request.json()

    if (!roomType) {
      return NextResponse.json(
        { error: "Room type is required" },
        { status: 400 }
      )
    }

    // Get all bookings for the same room type
    const bookingsRef = collection(db, "guestbooking")
    const q = query(bookingsRef, where("roomType", "==", roomType.trim()))
    const querySnapshot = await getDocs(q)
    
    // Collect all booked date ranges (only for active bookings)
    const bookedRanges = []
    const bookedDates = new Set() // For individual dates
    
    querySnapshot.docs.forEach((doc) => {
      const booking = doc.data()
      // Trim status to handle "Approved " with trailing space
      const status = booking.status?.trim() || booking.status
      
      // Only include APPROVED bookings (Pending bookings don't block availability)
      if (status !== "Approved") {
        return
      }
      
      const checkIn = parseDate(booking.checkIn)
      const checkOut = parseDate(booking.checkOut)
      
      if (!checkIn || !checkOut) {
        return
      }
      
      // Reset to midnight
      checkIn.setHours(0, 0, 0, 0)
      checkOut.setHours(0, 0, 0, 0)
      
      // Add date range
      bookedRanges.push({
        checkIn: checkIn.toISOString().split("T")[0],
        checkOut: checkOut.toISOString().split("T")[0],
        status: status,
      })
      
      // Add all individual dates in the range to the set
      // Include check-in date and all dates up to and including check-out
      // For booking Nov 22-25, this means Nov 22, 23, 24, 25 are all blocked
      const currentDate = new Date(checkIn)
      currentDate.setUTCHours(0, 0, 0, 0)
      const endDate = new Date(checkOut)
      endDate.setUTCHours(0, 0, 0, 0)
      
      console.log("📅 Processing booking range:", {
        checkIn: checkIn.toISOString().split("T")[0],
        checkOut: checkOut.toISOString().split("T")[0],
        status: status
      })
      
      // Include check-out date as well (<= instead of <)
      // For booking Nov 22-25, this blocks: Nov 22, 23, 24, 25
      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split("T")[0]
        bookedDates.add(dateStr)
        // Use UTC date increment to avoid timezone issues
        currentDate.setUTCDate(currentDate.getUTCDate() + 1)
      }
    })

    const finalBookedDates = Array.from(bookedDates).sort()
    
    console.log("📅 Final booked dates for", roomType.trim(), ":", finalBookedDates)
    console.log("📅 Total booked dates:", finalBookedDates.length)
    console.log("📅 Booked ranges:", bookedRanges)
    
    return NextResponse.json({
      bookedRanges: bookedRanges,
      bookedDates: finalBookedDates,
    })
  } catch (error) {
    console.error("Error getting booked dates:", error)
    return NextResponse.json(
      { error: "Failed to get booked dates" },
      { status: 500 }
    )
  }
}

