import { NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, doc, getDoc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore"

export async function POST(request) {
  try {
    const { bookingId } = await request.json()

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

    const calcNights = (checkIn, checkOut) => {
      if (!checkIn || !checkOut) return 0
      const inDate = String(checkIn).includes("T") ? new Date(checkIn) : new Date(checkIn + "T00:00:00")
      const outDate = String(checkOut).includes("T") ? new Date(checkOut) : new Date(checkOut + "T00:00:00")
      if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0
      inDate.setHours(0, 0, 0, 0)
      outDate.setHours(0, 0, 0, 0)
      const diff = outDate.getTime() - inDate.getTime()
      const nights = Math.ceil(diff / (1000 * 60 * 60 * 24))
      return nights > 0 ? nights : 1
    }

    const nights = calcNights(bookingData.checkIn, bookingData.checkOut)

    // Resolve pricePerNight: prefer booking.pricePerNight; otherwise look up matching room in tenant scope.
    let pricePerNight = Number(bookingData.pricePerNight || 0) || 0
    let discountPct = 0

    if (!pricePerNight && bookingData.roomType) {
      const tenantOwnerUid = bookingData.ownerUid || null
      const roomsRef = collection(db, "rooms")
      const q = tenantOwnerUid ? query(roomsRef, where("ownerUid", "==", tenantOwnerUid)) : query(roomsRef)
      const snap = await getDocs(q)
      const target = String(bookingData.roomType || "").trim().toLowerCase()
      const rooms = snap.docs.map((d) => d.data())
      const match =
        rooms.find((r) => String(r?.name || "").trim().toLowerCase() === target) ||
        rooms.find((r) => String(r?.type || "").trim().toLowerCase() === target) ||
        null
      if (match) {
        const base = Number(match.price || 0) || 0
        discountPct = Number(match.discount || 0) || 0
        pricePerNight = discountPct > 0 ? base * (1 - discountPct / 100) : base
      }
    }

    const total = nights > 0 ? pricePerNight * nights : 0

    // Update booking with payment information
    const updateData = {
      status: "Approved",
      paymentStatus: "paid",
      paidAmount: total || 0,
      totalPrice: total || 0,
      pricePerNight: pricePerNight || bookingData.pricePerNight || null,
      nights: nights || null,
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    await updateDoc(bookingRef, updateData)

    console.log(`✅ Booking ${bookingId} marked as paid & approved. Amount: ₱${total || 0}`)

    return NextResponse.json({
      success: true,
      message: "Booking marked as paid & approved",
      bookingId: bookingId,
      paidAmount: total || 0,
      nights: nights || 0,
      pricePerNight: pricePerNight || 0,
    })
  } catch (error) {
    console.error("Error marking booking as paid:", error)
    return NextResponse.json(
      { error: "Failed to mark booking as paid", details: error.message },
      { status: 500 }
    )
  }
}

