import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs } from "firebase/firestore"

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
    // Ensure date string is treated as UTC to avoid timezone issues
    return new Date(dateValue + "T00:00:00Z")
  }
  
  // Try parsing as-is
  return new Date(dateValue)
}

export async function POST(request) {
  try {
    const { roomType, checkIn, checkOut } = await request.json()

    if (!roomType || !checkIn || !checkOut) {
      return NextResponse.json(
        { error: "Room type, check-in, and check-out dates are required" },
        { status: 400 }
      )
    }

    // Parse dates - handle YYYY-MM-DD string format
    const newCheckIn = parseDate(checkIn)
    const newCheckOut = parseDate(checkOut)

    // Validate dates
    if (isNaN(newCheckIn.getTime()) || isNaN(newCheckOut.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      )
    }

    if (newCheckIn >= newCheckOut) {
      return NextResponse.json(
        { error: "Check-out date must be after check-in date" },
        { status: 400 }
      )
    }

    const trimmedRoomType = roomType.trim()
    console.log("Checking availability for:", {
      roomType: trimmedRoomType,
      newCheckIn: checkIn,
      newCheckOut: checkOut,
    })





















    // Get all bookings for the same room type
    const bookingsRef = collection(db, "guestbooking")
    const q = query(bookingsRef, where("roomType", "==", trimmedRoomType))
    const querySnapshot = await getDocs(q)
    
    console.log(`Found ${querySnapshot.size} bookings for room type: "${trimmedRoomType}"`)
    
    if (querySnapshot.size === 0) {
      console.log("No bookings found - dates are available")
      return NextResponse.json({
        available: true,
        conflicts: [],
      })
    }
    
    // Check for date overlaps (only for active bookings: Pending or Approved)
    const conflicts = []
    
    querySnapshot.docs.forEach((doc) => {
      const existingBooking = doc.data()
      // Trim status to handle "Approved " with trailing space
      const status = existingBooking.status?.trim() || existingBooking.status
      const existingRoomType = existingBooking.roomType?.trim() || existingBooking.roomType
      
      console.log("Checking booking:", {
        id: doc.id,
        existingRoomType: existingRoomType,
        requestedRoomType: trimmedRoomType,
        roomTypeMatch: existingRoomType === trimmedRoomType,
        checkIn: existingBooking.checkIn,
        checkOut: existingBooking.checkOut,
        status: status,
      })
      
      // Double-check room type match (case-insensitive)
      if (existingRoomType?.toLowerCase() !== trimmedRoomType.toLowerCase()) {
        console.log("Skipping - room type doesn't match")
        return
      }
      
      // Only check conflicts for APPROVED bookings (Pending bookings don't block availability)
      if (status !== "Approved") {
        console.log("Skipping - status is not Approved (only Approved bookings block dates):", status)
        return
      }
      
      // Parse existing booking dates using helper function
      const existingCheckIn = parseDate(existingBooking.checkIn)
      const existingCheckOut = parseDate(existingBooking.checkOut)
      
      if (!existingCheckIn || !existingCheckOut) {
        console.log("Skipping - invalid dates in existing booking")
        return
      }
      
      // Reset time to midnight for accurate date comparison
      existingCheckIn.setHours(0, 0, 0, 0)
      existingCheckOut.setHours(0, 0, 0, 0)
      newCheckIn.setHours(0, 0, 0, 0)
      newCheckOut.setHours(0, 0, 0, 0)
      
      console.log("Date comparison:", {
        existing: {
          checkIn: existingCheckIn.toISOString().split("T")[0],
          checkOut: existingCheckOut.toISOString().split("T")[0],
        },
        new: {
          checkIn: newCheckIn.toISOString().split("T")[0],
          checkOut: newCheckOut.toISOString().split("T")[0],
        },
      })
      
      // Check if dates overlap: 
      // Overlap occurs if: newCheckIn <= existingCheckOut AND newCheckOut >= existingCheckIn
      // We use <= and >= to include check-out dates (since check-out date is also blocked)
      // This covers all cases including:
      // - Exact same dates
      // - New booking starts during existing booking
      // - New booking ends during existing booking
      // - New booking completely contains existing booking
      // - Existing booking completely contains new booking
      const overlaps = newCheckIn <= existingCheckOut && newCheckOut >= existingCheckIn
      
      console.log("Overlaps?", overlaps)
      
      if (overlaps) {
        conflicts.push({
          checkIn: existingCheckIn.toISOString().split("T")[0],
          checkOut: existingCheckOut.toISOString().split("T")[0],
          status: status,
        })
      }
    })
    
    console.log("Final conflicts:", conflicts)

    return NextResponse.json({
      available: conflicts.length === 0,
      conflicts: conflicts,
    })
  } catch (error) {
    console.error("Error checking availability:", error)
    return NextResponse.json(
      { error: "Failed to check availability" },
      { status: 500 }
    )
  }
}

