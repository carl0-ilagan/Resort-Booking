"use client"

import { useState, useEffect, useRef } from "react"
import { Menu, X, Star, MapPin, Phone, Mail, Send, ChevronLeft, ChevronRight, ZoomIn, Loader2, Moon, Sun } from "lucide-react"
import { useBranding } from "@/hooks/use-branding"
import DynamicHead from "@/components/dynamic-head"
import { db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, where } from "firebase/firestore"
import { syncManager } from "@/lib/offline-storage"
import PWAInstallButton from "@/components/pwa-install-button"
import dynamic from "next/dynamic"

// Dynamically import ReCAPTCHA to avoid SSR issues
const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
})
import { toast } from "sonner"
import { Toaster } from "sonner"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

// Feedback will be fetched from Firestore dynamically

// Room Card Component with Image Carousel
function RoomCard({ room, onViewDetails, onImageClick, theme = "light" }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const images = room.images?.length > 0 ? room.images.slice(0, 3) : []

  // Auto-slide images every 4 seconds
  useEffect(() => {
    if (images.length <= 1) return

    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % images.length)
    }, 4000)

    return () => clearInterval(interval)
  }, [images.length])

  const goToPrevious = (e) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const goToNext = (e) => {
    e.stopPropagation()
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const handleImageClick = (e, image) => {
    e.stopPropagation()
    onImageClick(image)
  }

  const handleBookNow = (e) => {
    e.stopPropagation()
    // Don't proceed if room is not available
    const availability = room.availability?.trim() || room.availability
    if (availability && availability !== "Available") {
      return
    }
    // Pre-fill the room type in booking form
    if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent("prefillRoom", {
        detail: { roomName: room.name },
      })
    )
    }
    document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })
  }

  // Check if room is available for booking
  const availability = room.availability?.trim() || room.availability
  const isAvailable = !availability || availability === "Available"
  const isDark = theme === "dark"

  return (
    <div className={`group rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 ${
      isDark
        ? "bg-slate-800 border border-slate-700"
        : "bg-white border border-emerald-50"
    }`}>
      {/* Image Carousel */}
      <div className={`relative h-64 overflow-hidden ${
        isDark ? "bg-slate-700" : "bg-emerald-50"
      }`}>
        {images.length > 0 ? (
          <>
            <img
              src={images[currentImageIndex]}
              alt={`${room.name} - Image ${currentImageIndex + 1}`}
              className="w-full h-full object-cover transition-opacity duration-500 cursor-pointer"
              onClick={(e) => handleImageClick(e, images[currentImageIndex])}
            />
            {/* Navigation Arrows */}
            {images.length > 1 && (
              <>
                <button
                  onClick={goToPrevious}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-emerald-700 rounded-full p-2 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-emerald-700 rounded-full p-2 transition-all opacity-0 group-hover:opacity-100 shadow-lg"
                  aria-label="Next image"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
            {/* Image Indicators */}
            {images.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentImageIndex(idx)
                    }}
                    className={`h-2 rounded-full transition-all ${
                      idx === currentImageIndex ? "w-8 bg-white" : "w-2 bg-white/50"
                    }`}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
            {/* Zoom Icon Overlay */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-white/90 rounded-full p-2 shadow-lg">
                <ZoomIn size={18} className="text-emerald-700" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-emerald-600">
            <p className="text-sm">No image available</p>
          </div>
        )}
      </div>

      {/* Card Content */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className={`text-xl font-bold line-clamp-1 flex-1 ${
            isDark ? "text-white" : "text-emerald-700"
          }`}>{room.name}</h3>
          {room.featured && (
            <span className={`ml-2 rounded-full px-2 py-1 text-xs font-semibold ${
              isDark
                ? "bg-amber-900/50 text-amber-300"
                : "bg-amber-100 text-amber-700"
            }`}>
              Featured
            </span>
          )}
        </div>

        <div className="mb-4">
          <p className={`text-2xl font-bold ${
            isDark ? "text-amber-400" : "text-amber-600"
          }`}>
            ₱{room.price?.toLocaleString() || 0}
            <span className={`text-sm font-normal ${
              isDark ? "text-gray-400" : "text-gray-500"
            }`}>/night</span>
          </p>
          {room.discount > 0 && (
            <p className={`text-sm line-through ${
              isDark ? "text-gray-500" : "text-gray-500"
            }`}>
              ₱{Math.round((room.price * 100) / (100 - room.discount)).toLocaleString()}
            </p>
          )}
        </div>

        <p className={`mb-4 text-sm ${
          isDark ? "text-gray-400" : "text-gray-600"
        }`}>Max {room.maxGuests || 2} guests</p>

        {room.amenities?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {room.amenities.slice(0, 3).map((amenity, idx) => (
              <span
                key={idx}
                className={`text-xs rounded-full px-2 py-1 font-medium ${
                  isDark
                    ? "bg-emerald-900/50 text-emerald-300"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {amenity}
              </span>
            ))}
            {room.amenities.length > 3 && (
              <span className={`text-xs rounded-full px-2 py-1 font-medium ${
                isDark
                  ? "bg-slate-700 text-gray-300"
                  : "bg-gray-100 text-gray-600"
              }`}>
                +{room.amenities.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onViewDetails}
            className={`flex-1 py-2.5 rounded-lg transition-all duration-200 font-semibold text-sm ${
              isDark
                ? "bg-slate-700 text-gray-300 hover:bg-slate-600"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            View Details
          </button>
          <button
            onClick={handleBookNow}
            disabled={!isAvailable}
            className={`flex-1 py-2.5 rounded-lg transition-all duration-200 font-semibold text-sm ${
              isAvailable
                ? isDark
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-md hover:shadow-lg transform hover:scale-105 cursor-pointer"
                  : "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white hover:from-emerald-700 hover:to-emerald-800 shadow-md hover:shadow-lg transform hover:scale-105 cursor-pointer"
                : isDark
                  ? "bg-slate-700 text-gray-500 cursor-not-allowed opacity-60"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
            }`}
            title={!isAvailable ? `Room is currently ${availability?.toLowerCase() || "unavailable"}. Only available rooms can be booked.` : ""}
          >
            {isAvailable ? "Book Now" : availability === "Maintenance" ? "Under Maintenance" : "Unavailable"}
          </button>
        </div>
      </div>
    </div>
  )
}

const ROOMS_PER_PAGE = 6

export default function Home() {
  const { branding } = useBranding()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeRoom, setActiveRoom] = useState(null)
  const [rooms, setRooms] = useState([])
  const [loadingRooms, setLoadingRooms] = useState(true)
  const [previewImage, setPreviewImage] = useState(null)
  const [roomsPage, setRoomsPage] = useState(1)
  const [isModalClosing, setIsModalClosing] = useState(false)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("landing-theme")
      return saved || "light"
    }
    return "light"
  })

  // Apply theme to document
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (theme === "dark") {
        document.documentElement.classList.add("dark")
      } else {
        document.documentElement.classList.remove("dark")
      }
      localStorage.setItem("landing-theme", theme)
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    checkIn: "",
    checkOut: "",
    guests: "",
    roomType: "",
    specialRequests: "",
  })
  const [otpSent, setOtpSent] = useState(false)
  const [otpCode, setOtpCode] = useState("")
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [bookingSubmitting, setBookingSubmitting] = useState(false)
  
  // Auto-submit when OTP reaches 6 digits
  useEffect(() => {
    if (otpCode.length === 6 && !otpVerifying && otpSent) {
      // Small delay to ensure state is updated
      const timer = setTimeout(() => {
        // Create a synthetic submit event
        const syntheticEvent = {
          preventDefault: () => {},
          target: { closest: () => null },
        }
        handleBooking(syntheticEvent)
      }, 300) // Small delay to show the loading state
      return () => clearTimeout(timer)
    }
  }, [otpCode, otpVerifying, otpSent])
  const [recaptchaToken, setRecaptchaToken] = useState(null)
  const recaptchaRef = useRef(null)
  const [dateAvailability, setDateAvailability] = useState({ checking: false, available: true, message: "" })
  const [bookedDates, setBookedDates] = useState([])
  const [bookedRanges, setBookedRanges] = useState([])
  const [checkInCalendarOpen, setCheckInCalendarOpen] = useState(false)
  const [checkOutCalendarOpen, setCheckOutCalendarOpen] = useState(false)
  const [feedback, setFeedback] = useState({ name: "", email: "", rating: 5, message: "" })
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbacks, setFeedbacks] = useState([])
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(true)
  const [currentFeedbackIndex, setCurrentFeedbackIndex] = useState(0)
  const [bookingConfirmed, setBookingConfirmed] = useState(false)
  const [contact, setContact] = useState({ name: "", email: "", message: "" })
  const [contactSubmitting, setContactSubmitting] = useState(false)

  // Fetch rooms from Firestore
  useEffect(() => {
    const roomsRef = collection(db, "rooms")
    
    // Fetch all rooms - we'll sort in JavaScript to avoid Firestore index requirements
    const q = query(roomsRef)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const roomsData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((room) => {
            // Only show rooms that are marked as "Available"
            // If availability field doesn't exist, show the room (for backward compatibility)
            // Filter out "Maintenance" and "Unavailable" rooms
            if (!room.availability) {
              return true // Show room if availability field doesn't exist
            }
            return room.availability === "Available"
          })
          // Sort by createdAt if available, otherwise keep original order
          .sort((a, b) => {
            if (a.createdAt && b.createdAt) {
              return b.createdAt.toMillis() - a.createdAt.toMillis()
            }
            return 0
          })
        setRooms(roomsData)
        setLoadingRooms(false)
      },
      (error) => {
        console.error("Error fetching rooms:", error)
        setLoadingRooms(false)
      }
    )

    return () => unsubscribe()
  }, [])

  // Calculate pagination
  const totalRoomPages = Math.max(1, Math.ceil(rooms.length / ROOMS_PER_PAGE))
  const paginatedRooms = rooms.slice((roomsPage - 1) * ROOMS_PER_PAGE, roomsPage * ROOMS_PER_PAGE)

  // Smooth scroll handler
  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault()
    const element = document.getElementById(targetId)
    if (element) {
      const offset = 80 // Account for fixed navbar height
      const elementPosition = element.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.pageYOffset - offset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
    }
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (activeRoom) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
  }, [activeRoom])

  // Listen for room prefill event
  useEffect(() => {
    const handlePrefillRoom = (event) => {
      setFormData((prev) => ({ ...prev, roomType: event.detail.roomName }))
    }
    window.addEventListener("prefillRoom", handlePrefillRoom)
    return () => window.removeEventListener("prefillRoom", handlePrefillRoom)
  }, [])

  // Fetch booked dates when room type is selected
  useEffect(() => {
    const fetchBookedDates = async () => {
      if (!formData.roomType) {
        setBookedDates([])
        setBookedRanges([])
        return
      }

      try {
        const response = await fetch("/api/booking/get-booked-dates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomType: formData.roomType }),
        })

        const data = await response.json()

        if (response.ok) {
          const dates = data.bookedDates || []
          console.log("📅 Fetched booked dates for", formData.roomType, ":", dates)
          console.log("📅 Booked ranges:", data.bookedRanges || [])
          setBookedDates(dates)
          setBookedRanges(data.bookedRanges || [])
        } else {
          console.error("❌ Failed to fetch booked dates:", data.error)
          setBookedDates([])
          setBookedRanges([])
        }
      } catch (error) {
        console.error("❌ Error fetching booked dates:", error)
        setBookedDates([])
        setBookedRanges([])
      }
    }

    fetchBookedDates()
  }, [formData.roomType])

  // Quick validation - no async checking, just check booked dates locally
  useEffect(() => {
    // Reset availability when dates change
    if (!formData.roomType || !formData.checkIn) {
      setDateAvailability({ checking: false, available: true, message: "" })
      return
    }

    // Check if check-in date is booked
    if (bookedDates.includes(formData.checkIn)) {
      setDateAvailability({
        checking: false,
        available: false,
        message: "This check-in date is already booked. Please select a different date.",
      })
      return
    }

    // If only check-in is selected
    if (!formData.checkOut) {
      setDateAvailability({
        checking: false,
        available: true,
        message: "Please select a check-out date.",
      })
      return
    }

    // Both dates selected - validate
    const checkInDate = new Date(formData.checkIn + "T00:00:00")
    const checkOutDate = new Date(formData.checkOut + "T00:00:00")
    
    if (checkInDate >= checkOutDate) {
      setDateAvailability({ checking: false, available: false, message: "Check-out must be after check-in" })
      return
    }

    // Check if check-out date is booked
    if (bookedDates.includes(formData.checkOut)) {
      setDateAvailability({
        checking: false,
        available: false,
        message: "This check-out date is already booked. Please select a different date.",
      })
      return
    }

    // Quick check: if any date in the range is booked, it's not available
    // Check ALL dates from check-in to check-out (inclusive)
    // Use local date formatting to avoid timezone issues
    const checkInParts = formData.checkIn.split("-").map(Number)
    const checkOutParts = formData.checkOut.split("-").map(Number)
    const startDate = new Date(checkInParts[0], checkInParts[1] - 1, checkInParts[2])
    const endDate = new Date(checkOutParts[0], checkOutParts[1] - 1, checkOutParts[2])
    
    const hasBookedDate = []
    
    console.log("🔍 Checking date range:", {
      checkIn: formData.checkIn,
      checkOut: formData.checkOut,
      bookedDates: bookedDates,
      bookedDatesCount: bookedDates.length
    })
    
    // Loop through each date from check-in to check-out (inclusive)
    const currentDate = new Date(startDate)
    while (currentDate <= endDate) {
      // Format date in local timezone (YYYY-MM-DD)
      const year = currentDate.getFullYear()
      const month = String(currentDate.getMonth() + 1).padStart(2, "0")
      const day = String(currentDate.getDate()).padStart(2, "0")
      const dateStr = `${year}-${month}-${day}`
      
      if (bookedDates.includes(dateStr)) {
        hasBookedDate.push(dateStr)
        console.log("❌ Found booked date in range:", dateStr)
      }
      
      // Move to next day in local timezone
      currentDate.setDate(currentDate.getDate() + 1)
    }

    if (hasBookedDate.length > 0) {
      console.log("🚫 Date range blocked by booked dates:", hasBookedDate)
      setDateAvailability({
        checking: false,
        available: false,
        message: `Selected date range includes already booked dates (${hasBookedDate.join(", ")}). Please choose different dates.`,
      })
      return
    }
    
    console.log("✅ Date range is available")
    // All dates are available
    setDateAvailability({ checking: false, available: true, message: "" })
  }, [formData.roomType, formData.checkIn, formData.checkOut, bookedDates])

  // Helper function to check if a date is disabled (booked or in the past)
  const isDateDisabled = (dateString) => {
    if (!dateString) return false
    const date = new Date(dateString + "T00:00:00")
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Disable past dates
    if (date < today) return true
    
    // Disable booked dates
    if (bookedDates.includes(dateString)) return true
    
    return false
  }

  const handleBooking = async (e) => {
    e.preventDefault()
    
    if (!otpSent) {
      // Step 1: Check date availability before proceeding
      if (!dateAvailability.available) {
        toast.error(dateAvailability.message || "Selected dates are not available. Please choose different dates.")
        return
      }

      // Step 2: Check reCAPTCHA before sending OTP
      if (!recaptchaToken) {
        toast.error("Please complete the reCAPTCHA verification")
        return
      }

      // Step 3: Verify reCAPTCHA on server
      setBookingSubmitting(true)
      try {
        // Verify reCAPTCHA first
        const recaptchaResponse = await fetch("/api/booking/verify-recaptcha", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: recaptchaToken }),
        })

        const recaptchaData = await recaptchaResponse.json()
        
        if (!recaptchaResponse.ok) {
          toast.error(recaptchaData.error || "reCAPTCHA verification failed")
          recaptchaRef.current?.reset()
          setRecaptchaToken(null)
          return
        }

        // Normalize email (trim and lowercase)
        const normalizedEmail = formData.email.trim().toLowerCase()
        const response = await fetch("/api/booking/send-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: normalizedEmail }),
        })
        
        const data = await response.json()
        
        if (response.ok) {
          setOtpSent(true)
          setBookingConfirmed(false)
          toast.success("OTP sent successfully! Check your email.")
          // Reset reCAPTCHA
          recaptchaRef.current?.reset()
          setRecaptchaToken(null)
        } else {
          // Special handling for booking limit
          if (data.limitReached) {
            toast.error(data.error || "This email has reached the booking limit.", {
              duration: 8000,
            })
          } else {
            toast.error(data.error || "Failed to send OTP. Please try again.")
          }
        }
      } catch (error) {
        console.error("Error sending OTP:", error)
        toast.error("Failed to send OTP. Please try again.")
      } finally {
        setBookingSubmitting(false)
      }
    } else {
      // Step 3: Verify OTP and save booking
      setOtpVerifying(true)
      try {
        // Normalize email (trim and lowercase) and OTP (trim)
        const normalizedEmail = formData.email.trim().toLowerCase()
        const normalizedOtp = otpCode.trim()
        
        // Use offline-first approach
        const result = await syncManager.submitWithOfflineSupport(
          "/api/booking/verify-otp",
          "POST",
          {
            ...formData,
            email: normalizedEmail,
            otp: normalizedOtp,
          },
          "booking",
          24 * 60 * 60 * 1000 // 24 hours max age
        )
        
        if (result.success) {
          toast.success("Booking confirmed successfully! We've sent a confirmation email. Your booking status is pending admin approval.", {
            duration: 6000,
          })
          // Reset form
          setFormData({
            name: "",
            email: "",
            phone: "",
            checkIn: "",
            checkOut: "",
            guests: "",
            roomType: "",
            specialRequests: "",
          })
          setOtpSent(false)
          setOtpCode("")
    setBookingConfirmed(true)
        } else if (result.offlineId) {
          // Saved for offline - show success message
          toast.success("Your booking is saved offline and will be submitted when you're back online!", {
            duration: 6000,
            })
          // Reset form
          setFormData({
            name: "",
            email: "",
            phone: "",
            checkIn: "",
            checkOut: "",
            guests: "",
            roomType: "",
            specialRequests: "",
            })
          setOtpSent(false)
          setOtpCode("")
          setBookingConfirmed(true)
          } else {
          toast.error(result.error || "Failed to submit booking. Please try again.")
        }
      } catch (error) {
        console.error("Error verifying OTP:", error)
        toast.error(`Failed to verify OTP. Error: ${error.message || "Unknown error"}`)
      } finally {
        setOtpVerifying(false)
      }
    }
  }

  // Fetch feedbacks from Firestore
  useEffect(() => {
    const feedbacksRef = collection(db, "feedbacks")
    // Fetch all feedbacks - we'll filter and sort in JavaScript to avoid Firestore index requirements
    const q = query(feedbacksRef)

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const feedbacksData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .filter((fb) => {
            // Filter for Published status (case-insensitive and trimmed)
            const status = (fb.status || "").trim()
            return status === "Published"
          })
          .sort((a, b) => {
            // Sort by createdAt descending (newest first)
            if (a.createdAt && b.createdAt) {
              // Handle Firestore Timestamp
              if (a.createdAt.toMillis && b.createdAt.toMillis) {
                return b.createdAt.toMillis() - a.createdAt.toMillis()
              }
              // Handle regular Date objects
              if (a.createdAt.getTime && b.createdAt.getTime) {
                return b.createdAt.getTime() - a.createdAt.getTime()
              }
            }
            return 0
          })
          .slice(0, 9) // Limit to 9 most recent feedbacks
        
        console.log("Fetched feedbacks:", feedbacksData.length, feedbacksData)
        setFeedbacks(feedbacksData)
        setLoadingFeedbacks(false)
      },
      (error) => {
        console.error("Error fetching feedbacks:", error)
        // Try to fetch without query if there's an index error
        if (error.code === "failed-precondition") {
          console.warn("Firestore index missing. Fetching all feedbacks without filter...")
          const simpleQuery = query(feedbacksRef)
          onSnapshot(
            simpleQuery,
            (snapshot) => {
              const allFeedbacks = snapshot.docs
                .map((doc) => ({
                  id: doc.id,
                  ...doc.data(),
                }))
                .filter((fb) => {
                  const status = (fb.status || "").trim()
                  return status === "Published"
                })
                .sort((a, b) => {
                  if (a.createdAt && b.createdAt) {
                    if (a.createdAt.toMillis && b.createdAt.toMillis) {
                      return b.createdAt.toMillis() - a.createdAt.toMillis()
                    }
                    if (a.createdAt.getTime && b.createdAt.getTime) {
                      return b.createdAt.getTime() - a.createdAt.getTime()
                    }
                  }
                  return 0
                })
                .slice(0, 9)
              console.log("Fetched feedbacks (fallback):", allFeedbacks.length, allFeedbacks)
              setFeedbacks(allFeedbacks)
              setLoadingFeedbacks(false)
            },
            (fallbackError) => {
              console.error("Fallback query also failed:", fallbackError)
              setLoadingFeedbacks(false)
            }
          )
        } else {
          setLoadingFeedbacks(false)
        }
      }
    )

    return () => {
      unsubscribe()
    }
  }, [])

  // Auto-scroll feedbacks every 5 seconds
  useEffect(() => {
    if (feedbacks.length <= 3) return // No need to scroll if 3 or less

    const interval = setInterval(() => {
      setCurrentFeedbackIndex((prev) => {
        const maxIndex = Math.max(0, feedbacks.length - 3)
        if (prev >= maxIndex) {
          return 0 // Loop back to start
        }
        return prev + 3 // Move to next set of 3
      })
    }, 5000) // Change every 5 seconds

    return () => clearInterval(interval)
  }, [feedbacks.length])

  const handleFeedback = async (e) => {
    e.preventDefault()
    
    setFeedbackSubmitting(true)
    
    try {
      const result = await syncManager.submitWithOfflineSupport(
        "/api/feedback/submit",
        "POST",
        {
          name: feedback.name,
          email: feedback.email,
          rating: feedback.rating,
          message: feedback.message,
        },
        "feedback",
        7 * 24 * 60 * 60 * 1000 // 7 days max age for feedback
      )

      if (result.success) {
        toast.success("Thank you for your feedback! We appreciate your input.")
    setFeedback({ name: "", email: "", rating: 5, message: "" })
      } else if (result.offlineId) {
        toast.success("Your feedback is saved offline and will be submitted when you're back online!")
        setFeedback({ name: "", email: "", rating: 5, message: "" })
      } else {
        toast.error(result.error || "Failed to submit feedback. Please try again.")
      }
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast.error("Failed to submit feedback. Please try again.")
    } finally {
      setFeedbackSubmitting(false)
    }
  }

  const handleContact = async (e) => {
    e.preventDefault()
    
    setContactSubmitting(true)
    
    try {
      const result = await syncManager.submitWithOfflineSupport(
        "/api/contact/send-message",
        "POST",
        {
          name: contact.name,
          email: contact.email,
          message: contact.message,
        },
        "contact",
        7 * 24 * 60 * 60 * 1000 // 7 days max age for contact messages
      )

      if (result.success) {
        toast.success("Message sent successfully! We'll get back to you soon.")
    setContact({ name: "", email: "", message: "" })
      } else if (result.offlineId) {
        toast.success("Your message is saved offline and will be sent when you're back online!")
        setContact({ name: "", email: "", message: "" })
      } else {
        toast.error(result.error || "Failed to send message. Please try again.")
      }
    } catch (error) {
      console.error("Error sending contact message:", error)
      toast.error("Failed to send message. Please try again.")
    } finally {
      setContactSubmitting(false)
    }
  }

  const handleModalClose = () => {
    setIsModalClosing(true)
    setTimeout(() => {
      setActiveRoom(null)
      setIsModalClosing(false)
    }, 300)
  }

  return (
    <div className={`min-h-screen transition-colors ${
      theme === "dark"
        ? "bg-gradient-to-b from-slate-900 to-slate-800"
        : "bg-gradient-to-b from-slate-50 to-white"
    }`} style={{ scrollBehavior: "smooth" }}>
      <style jsx global>{`
        html {
          scroll-behavior: smooth;
        }
      `}</style>
      <DynamicHead />
      {/* Navigation */}
      <nav className={`fixed w-full top-0 z-50 shadow-md transition-colors ${
        theme === "dark" ? "bg-slate-800" : "bg-white"
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <img
                src={branding.logo || "/placeholder-logo.png"}
                alt={`${branding.name} logo`}
                className={`h-10 w-10 rounded-full object-cover border ${
                  theme === "dark" ? "border-slate-600" : "border-emerald-100"
                }`}
              />
              <div className={`text-xl sm:text-2xl font-bold tracking-[0.2em] uppercase hidden sm:block ${
                theme === "dark" ? "text-white" : "text-emerald-700"
              }`}>
                {branding.name}
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              {["Home", "Rooms", "Booking", "About", "Contact"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={(e) => handleSmoothScroll(e, item.toLowerCase())}
                  className={`transition cursor-pointer ${
                    theme === "dark"
                      ? "text-gray-300 hover:text-white"
                      : "text-gray-700 hover:text-emerald-700"
                  }`}
                >
                  {item}
                </a>
              ))}
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition ${
                  theme === "dark"
                    ? "text-gray-300 hover:bg-slate-700 hover:text-white"
                    : "text-gray-700 hover:bg-gray-100 hover:text-emerald-700"
                }`}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={toggleTheme}
                className={`p-2 rounded-lg transition ${
                  theme === "dark"
                    ? "text-gray-300 hover:bg-slate-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
                className={`transition-transform duration-200 ${
                  theme === "dark" ? "text-gray-300" : "text-gray-700"
                }`}
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
          <div 
            className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
              mobileMenuOpen 
                ? "max-h-96 opacity-100 pb-4" 
                : "max-h-0 opacity-0 pb-0"
            }`}
          >
            <div className="flex flex-col space-y-3 pt-2">
              {["Home", "Rooms", "Booking", "About", "Contact"].map((item, index) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase()}`}
                  onClick={(e) => {
                    handleSmoothScroll(e, item.toLowerCase())
                    setMobileMenuOpen(false) // Close mobile menu after clicking
                  }}
                  className={`transition-all duration-200 cursor-pointer transform hover:translate-x-1 ${
                    theme === "dark"
                      ? "text-gray-300 hover:text-white"
                      : "text-gray-700 hover:text-emerald-700"
                  } ${
                    mobileMenuOpen 
                      ? "opacity-100 translate-x-0" 
                      : "opacity-0 -translate-x-4"
                  }`}
                  style={{
                    transitionDelay: mobileMenuOpen ? `${index * 50}ms` : "0ms"
                  }}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        id="home"
        className={`pt-24 pb-16 px-4 sm:px-6 lg:px-8 text-white mt-16 ${
          theme === "dark"
            ? "bg-gradient-to-r from-slate-800 to-slate-700"
            : "bg-gradient-to-r from-emerald-700 to-emerald-600"
        }`}
      >
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Welcome to {branding.name}</h1>
          <p className="text-lg md:text-xl mb-8 opacity-90">{branding.tagline}</p>
          <button
            onClick={(e) => handleSmoothScroll(e, "booking")}
            className="bg-amber-500 hover:bg-amber-600 px-8 py-3 rounded-lg font-semibold transition cursor-pointer"
          >
            Book Now
          </button>
        </div>
      </section>

      {/* Rooms Section */}
      <section id="rooms" className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            theme === "dark" ? "text-white" : "text-emerald-700"
          }`}>Our Rooms</h2>
          {loadingRooms ? (
            <div className="grid md:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className={`group rounded-2xl shadow-lg overflow-hidden border animate-pulse ${
                  theme === "dark"
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-emerald-50"
                }`}>
                  {/* Image Skeleton */}
                  <div className={`relative h-64 ${
                    theme === "dark" ? "bg-slate-700" : "bg-emerald-50"
                  }`}></div>
                  {/* Content Skeleton */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-2">
                      <div className={`h-6 w-3/4 rounded ${
                        theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                      }`}></div>
                      <div className={`h-5 w-16 rounded-full ${
                        theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                      }`}></div>
                    </div>
                    <div className={`h-8 w-1/2 rounded mb-4 ${
                      theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                    }`}></div>
                    <div className={`h-4 w-2/3 rounded mb-4 ${
                      theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                    }`}></div>
                    <div className="flex gap-2 mb-4">
                      <div className={`h-6 w-16 rounded-full ${
                        theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                      }`}></div>
                      <div className={`h-6 w-20 rounded-full ${
                        theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                      }`}></div>
                    </div>
                    <div className="flex gap-2">
                      <div className={`flex-1 h-10 rounded-lg ${
                        theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                      }`}></div>
                      <div className={`flex-1 h-10 rounded-lg ${
                        theme === "dark" ? "bg-slate-700" : "bg-gray-200"
                      }`}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : rooms.length === 0 ? (
            <div className={`text-center py-12 ${
              theme === "dark" ? "text-gray-400" : "text-gray-500"
            }`}>
              <p>No rooms available at the moment.</p>
            </div>
          ) : (
            <>
          <div className="grid md:grid-cols-3 gap-8">
                {paginatedRooms.map((room) => (
                  <RoomCard
                key={room.id}
                    room={room}
                    onViewDetails={() => setActiveRoom(room.id)}
                    onImageClick={(image) => setPreviewImage(image)}
                    theme={theme}
                  />
                ))}
              </div>
              {totalRoomPages > 1 && (
                <div className={`mt-8 flex flex-col items-center gap-4 text-sm md:flex-row md:justify-between ${
                  theme === "dark" ? "text-gray-300" : "text-gray-600"
                }`}>
                  <button
                    onClick={() => setRoomsPage((prev) => Math.max(1, prev - 1))}
                    disabled={roomsPage === 1}
                    className={`inline-flex items-center gap-2 rounded-full border px-6 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      theme === "dark"
                        ? "border-emerald-700 bg-slate-800 text-emerald-300 hover:border-emerald-600 hover:bg-slate-700 disabled:hover:bg-slate-800"
                        : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 disabled:hover:bg-white"
                    }`}
                  >
                    Previous
                  </button>
                  <p className="font-medium">
                    Page {roomsPage} of {totalRoomPages}
                  </p>
                  <button
                    onClick={() => setRoomsPage((prev) => Math.min(totalRoomPages, prev + 1))}
                    disabled={roomsPage === totalRoomPages}
                    className={`inline-flex items-center gap-2 rounded-full border px-6 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      theme === "dark"
                        ? "border-emerald-700 bg-slate-800 text-emerald-300 hover:border-emerald-600 hover:bg-slate-700 disabled:hover:bg-slate-800"
                        : "border-emerald-200 bg-white text-emerald-800 hover:border-emerald-400 hover:bg-emerald-50 disabled:hover:bg-white"
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Room Detail Modal */}
      {activeRoom && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8 transition-opacity duration-300 ${
            isModalClosing ? "opacity-0" : "opacity-100"
          }`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              handleModalClose()
            }
          }}
        >
          <div
            className={`relative h-[92vh] w-full max-w-4xl rounded-t-3xl shadow-2xl flex flex-col overflow-hidden lg:h-[85vh] lg:max-w-6xl lg:rounded-3xl lg:flex-row transition-all duration-300 ${
              theme === "dark"
                ? "bg-slate-800 ring-1 ring-slate-700"
                : "bg-white ring-1 ring-emerald-100"
            } ${
              isModalClosing
                ? "translate-y-full lg:translate-y-0 lg:scale-95 lg:opacity-0"
                : "translate-y-0 lg:scale-100 lg:opacity-100 animate-[slideUp_0.3s_ease-out] lg:animate-[fadeInScale_0.3s_ease-out]"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {rooms
              .filter((r) => r.id === activeRoom)
              .map((room) => {
                const images = room.images?.length > 0 ? room.images : []
                return (
                  <div key={room.id} className="flex flex-col lg:flex-row h-full overflow-hidden">
                    {/* Close Button */}
                    <button
                      onClick={handleModalClose}
                      className="absolute right-4 top-4 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-md transition hover:bg-gray-50 hover:scale-110"
                      aria-label="Close modal"
                      type="button"
                    >
                      <X size={18} />
                    </button>

                    {/* Image Section - Left side on desktop, top on mobile */}
                    {images.length > 0 ? (
                      <div className="relative w-full h-64 lg:h-full lg:w-2/5 flex-shrink-0">
                        <img
                          src={images[0]}
                          alt={room.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-black/60 lg:via-black/20 lg:to-transparent" />
                        {room.featured && (
                          <span className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                            ⭐ Featured
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-full h-48 lg:h-full lg:w-2/5 flex-shrink-0 bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
                        {room.featured && (
                          <span className="absolute top-4 left-4 bg-amber-500 text-white px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                            ⭐ Featured
                          </span>
                        )}
                        <div className="text-white text-center px-4">
                          <p className="text-lg font-bold">{room.name}</p>
                        </div>
                      </div>
                    )}

                    {/* Content Section - Right side on desktop, below image on mobile */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                      {/* Content Area - Scrollable on mobile, fits on desktop */}
                      <div className="flex-1 overflow-y-auto lg:overflow-y-visible px-6 pb-4 pt-16 sm:px-8 sm:pt-12 lg:pt-12">
                        {/* Header */}
                        <header className="mb-4 lg:mb-6">
                          <p className="text-xs uppercase tracking-[0.35em] text-emerald-600 mb-2">Room Details</p>
                          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{room.name}</h2>
                          {!images.length && room.featured && (
                            <span className="inline-block bg-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                              ⭐ Featured
                            </span>
                          )}
                        </header>

                        {/* Desktop Layout - Two Columns */}
                        <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:h-full lg:content-between">
                          {/* Left Column */}
                          <div className="lg:flex lg:flex-col lg:justify-between">
                            {/* Price Section */}
                            <section className="mb-4 lg:mb-0 space-y-2 rounded-xl border border-gray-100 p-4 bg-gradient-to-br from-amber-50 to-emerald-50">
                              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600">Pricing</h3>
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="text-2xl lg:text-3xl font-bold text-amber-600">
                                  ₱{room.price?.toLocaleString() || 0}
                                </span>
                                <span className="text-gray-600 font-medium text-sm">/night</span>
                                {room.discount > 0 && (
                                  <>
                                    <span className="text-sm text-gray-500 line-through">
                                      ₱{Math.round((room.price * 100) / (100 - room.discount)).toLocaleString()}
                                    </span>
                                    <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-xs font-semibold">
                                      {room.discount}% OFF
                                    </span>
                                  </>
                                )}
                              </div>
                            </section>

                            {/* Room Info */}
                            <section className="mb-4 lg:mb-0 space-y-2 rounded-xl border border-gray-100 p-4">
                              <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600">Information</h3>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                                  <div className="bg-emerald-600 text-white rounded-full p-1.5 flex-shrink-0">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">Max Guests</p>
                                    <p className="text-sm font-bold text-emerald-700">{room.maxGuests || 2}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                                  <div className="bg-blue-600 text-white rounded-full p-1.5 flex-shrink-0">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-600">Status</p>
                                    <p className="text-sm font-bold text-blue-700">{room.availability || "Available"}</p>
                                  </div>
                                </div>
                              </div>
                            </section>
                          </div>

                          {/* Right Column */}
                          <div className="lg:flex lg:flex-col lg:justify-between">
                            {/* Description */}
                            {room.description && (
                              <section className="mb-4 lg:mb-0 space-y-2 rounded-xl border border-gray-100 p-4">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600">Description</h3>
                                <p className="text-gray-600 leading-relaxed text-xs lg:text-sm line-clamp-4 lg:line-clamp-none">{room.description}</p>
                              </section>
                            )}

                            {/* Amenities */}
                            {room.amenities && room.amenities.length > 0 && (
                              <section className="mb-4 lg:mb-0 space-y-2 rounded-xl border border-gray-100 p-4">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600">Amenities</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-2 gap-2">
                                  {room.amenities.slice(0, 6).map((amenity, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-1.5 p-1.5 bg-emerald-50 rounded-lg border border-emerald-100"
                                    >
                                      <svg className="w-3 h-3 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      <span className="text-gray-700 font-medium text-xs truncate">{amenity}</span>
                                    </div>
                                  ))}
                                  {room.amenities.length > 6 && (
                                    <div className="flex items-center justify-center p-1.5 bg-gray-50 rounded-lg border border-gray-200">
                                      <span className="text-gray-600 font-medium text-xs">+{room.amenities.length - 6} more</span>
                                    </div>
                                  )}
                                </div>
                              </section>
                            )}

                            {/* Image Gallery - Only on desktop if space allows */}
                            {images.length > 1 && (
                              <section className="mb-4 lg:mb-0 space-y-2 rounded-xl border border-gray-100 p-4 hidden lg:block">
                                <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600">Gallery</h3>
                                <div className="grid grid-cols-3 gap-2">
                                  {images.slice(1, 4).map((image, idx) => (
                                    <div
                                      key={idx}
                                      className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                                      onClick={() => setPreviewImage(image)}
                                    >
                                      <img
                                        src={image}
                                        alt={`${room.name} - Image ${idx + 2}`}
                                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                      />
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            )}
                          </div>
                        </div>

                        {/* Mobile Image Gallery - Below content on mobile */}
                        {images.length > 1 && (
                          <section className="mb-4 space-y-2 rounded-xl border border-gray-100 p-4 lg:hidden">
                            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-600">Gallery</h3>
                            <div className="grid grid-cols-3 gap-2">
                              {images.slice(1, 4).map((image, idx) => (
                                <div
                                  key={idx}
                                  className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group"
                                  onClick={() => setPreviewImage(image)}
                                >
                                  <img
                                    src={image}
                                    alt={`${room.name} - Image ${idx + 2}`}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                                  />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                    <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity" size={16} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="border-t border-gray-100 bg-gray-50 p-4 lg:p-6 flex-shrink-0">
                        <div className="flex flex-col sm:flex-row gap-2 lg:gap-3">
                  <button
                            onClick={() => {
                              // Don't proceed if room is not available
                              const roomAvailability = room.availability?.trim() || room.availability
                              if (roomAvailability && roomAvailability !== "Available") {
                                return
                              }
                              setFormData((prev) => ({ ...prev, roomType: room.name }))
                              handleModalClose()
                              setTimeout(() => {
                                document.getElementById("booking")?.scrollIntoView({ behavior: "smooth" })
                              }, 350)
                            }}
                            disabled={(() => {
                              const roomAvailability = room.availability?.trim() || room.availability
                              return roomAvailability && roomAvailability !== "Available"
                            })()}
                            className={`flex-1 rounded-xl px-4 py-2.5 lg:px-6 lg:py-3 font-semibold text-sm lg:text-base transition ${
                              (() => {
                                const roomAvailability = room.availability?.trim() || room.availability
                                const isAvailable = !roomAvailability || roomAvailability === "Available"
                                return isAvailable
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                              })()
                            }`}
                            title={(() => {
                              const roomAvailability = room.availability?.trim() || room.availability
                              if (roomAvailability && roomAvailability !== "Available") {
                                return `Room is currently ${roomAvailability.toLowerCase()}. Only available rooms can be booked.`
                              }
                              return ""
                            })()}
                          >
                            {(() => {
                              const roomAvailability = room.availability?.trim() || room.availability
                              const isAvailable = !roomAvailability || roomAvailability === "Available"
                              if (!isAvailable) {
                                return roomAvailability === "Maintenance" ? "Under Maintenance" : "Unavailable"
                              }
                              return "Book Now"
                            })()}
                          </button>
                  <button
                            onClick={handleModalClose}
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 lg:px-6 lg:py-3 font-semibold text-gray-700 text-sm lg:text-base transition hover:bg-gray-50 sm:flex-1"
                  >
                    Close
                  </button>
                </div>
                      </div>
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition"
          >
            <X size={32} />
          </button>
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Booking Section */}
      <section id="booking" className={`py-16 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-slate-800" : "bg-gray-50"
      }`}>
        <div className="max-w-3xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            theme === "dark" ? "text-white" : "text-emerald-700"
          }`}>Book Your Stay</h2>
          <form onSubmit={handleBooking} className={`p-8 rounded-lg shadow-lg ${
            theme === "dark" ? "bg-slate-700" : "bg-white"
          }`}>
            {!otpSent ? (
              <>
                {/* Step 1: Booking Form */}
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-4">Step 1 of 2: Fill in your booking details</p>
                </div>
                
            <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name *</label>
              <input
                type="text"
                      placeholder="Enter your full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address *</label>
              <input
                type="email"
                      placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
            </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number *</label>
              <input
                    type="tel"
                    placeholder="+63 912 345 6789"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
                </div>
                
            <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Check-in Date *
                      {formData.roomType && bookedDates.length > 0 && (
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          ({bookedDates.length} date{bookedDates.length !== 1 ? "s" : ""} booked)
                        </span>
                      )}
                    </label>
                    <Popover open={checkInCalendarOpen} onOpenChange={setCheckInCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors text-left ${
                            !dateAvailability.available && formData.roomType && formData.checkIn
                              ? "border-red-400 bg-red-50 focus:ring-red-500"
                              : bookedDates.includes(formData.checkIn)
                              ? "border-red-400 bg-red-50 focus:ring-red-500"
                              : formData.checkIn && dateAvailability.available
                              ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-500"
                              : "border-gray-300 focus:ring-emerald-700 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={formData.checkIn ? "text-gray-900" : "text-gray-500"}>
                              {formData.checkIn ? format(new Date(formData.checkIn + "T00:00:00"), "PPP") : "Select check-in date"}
                            </span>
                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.checkIn ? new Date(formData.checkIn + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (!date) return
                            // Format date in local timezone to avoid UTC conversion issues
                            const year = date.getFullYear()
                            const month = String(date.getMonth() + 1).padStart(2, "0")
                            const day = String(date.getDate()).padStart(2, "0")
                            const dateStr = `${year}-${month}-${day}`
                            
                            // Check if selected date is booked
                            if (bookedDates.includes(dateStr)) {
                              toast.error("⚠️ This date is already booked. Please select a different date.")
                              return
                            }
                            
                            setFormData({ ...formData, checkIn: dateStr, checkOut: "" })
                            setCheckInCalendarOpen(false)
                          }}
                          disabled={(date) => {
                            // Disable past dates
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            today.setMinutes(0, 0, 0)
                            if (date < today) return true
                            
                            // Disable booked dates - format date in local timezone
                            const year = date.getFullYear()
                            const month = String(date.getMonth() + 1).padStart(2, "0")
                            const day = String(date.getDate()).padStart(2, "0")
                            const dateStr = `${year}-${month}-${day}`
                            const isBooked = bookedDates.includes(dateStr)
                            
                            return isBooked
                          }}
                          modifiers={{
                            booked: bookedDates.map(d => {
                              // Parse date string and create date in local timezone
                              const [year, month, day] = d.split("-").map(Number)
                              const date = new Date(year, month - 1, day, 12, 0, 0) // Use local timezone
                              return date
                            }),
                          }}
                          modifiersClassNames={{
                            booked: "!bg-red-100 !text-red-800 line-through opacity-60 cursor-not-allowed hover:!bg-red-100",
                          }}
                          classNames={{
                            day_disabled: "opacity-50 cursor-not-allowed",
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {bookedDates.includes(formData.checkIn) && (
                      <p className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
                        <span>🔴</span> This date is already booked
                      </p>
                    )}
                    {formData.checkIn && dateAvailability.message && (
                      <p className={`mt-1 text-xs flex items-center gap-1 ${
                        dateAvailability.available ? "text-emerald-600" : "text-red-600"
                      }`}>
                        <span>{dateAvailability.available ? "✅" : "⚠️"}</span> {dateAvailability.message}
                      </p>
                    )}
            </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Check-out Date *</label>
                    <Popover open={checkOutCalendarOpen} onOpenChange={setCheckOutCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          disabled={!formData.checkIn}
                          className={`w-full p-3 border-2 rounded-lg focus:outline-none focus:ring-2 transition-colors text-left ${
                            !formData.checkIn
                              ? "border-gray-200 bg-gray-50 cursor-not-allowed"
                              : !dateAvailability.available && formData.roomType && formData.checkIn && formData.checkOut
                              ? "border-red-400 bg-red-50 focus:ring-red-500"
                              : bookedDates.includes(formData.checkOut)
                              ? "border-red-400 bg-red-50 focus:ring-red-500"
                              : formData.checkOut && dateAvailability.available
                              ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-500"
                              : "border-gray-300 focus:ring-emerald-700 bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={formData.checkOut ? "text-gray-900" : "text-gray-500"}>
                              {formData.checkOut ? format(new Date(formData.checkOut + "T00:00:00"), "PPP") : "Select check-out date"}
                            </span>
                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                          </div>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.checkOut ? new Date(formData.checkOut + "T00:00:00") : undefined}
                          onSelect={(date) => {
                            if (!date) return
                            // Format date in local timezone to avoid UTC conversion issues
                            const year = date.getFullYear()
                            const month = String(date.getMonth() + 1).padStart(2, "0")
                            const day = String(date.getDate()).padStart(2, "0")
                            const dateStr = `${year}-${month}-${day}`
                            
                            // Check if selected date is booked
                            if (bookedDates.includes(dateStr)) {
                              toast.error("⚠️ This date is already booked. Please select a different date.")
                              return
                            }
                            
                            // Validate check-out is after check-in
                            if (formData.checkIn && dateStr <= formData.checkIn) {
                              toast.error("Check-out date must be after check-in date.")
                              return
                            }
                            
                            setFormData({ ...formData, checkOut: dateStr })
                            setCheckOutCalendarOpen(false)
                          }}
                          disabled={(date) => {
                            // Disable past dates
                            const today = new Date()
                            today.setHours(0, 0, 0, 0)
                            if (date < today) return true
                            
                            // Disable dates before or equal to check-in
                            if (formData.checkIn) {
                              const checkInDate = new Date(formData.checkIn + "T00:00:00")
                              checkInDate.setHours(0, 0, 0, 0)
                              if (date <= checkInDate) return true
                            }
                            
                            // Disable booked dates - format date in local timezone
                            const year = date.getFullYear()
                            const month = String(date.getMonth() + 1).padStart(2, "0")
                            const day = String(date.getDate()).padStart(2, "0")
                            const dateStr = `${year}-${month}-${day}`
                            return bookedDates.includes(dateStr)
                          }}
                          modifiers={{
                            booked: bookedDates.map(d => {
                              // Parse date string and create date in local timezone
                              const [year, month, day] = d.split("-").map(Number)
                              const date = new Date(year, month - 1, day, 12, 0, 0) // Use local timezone
                              return date
                            }),
                          }}
                          modifiersClassNames={{
                            booked: "!bg-red-100 !text-red-800 line-through opacity-60 cursor-not-allowed hover:!bg-red-100",
                          }}
                          classNames={{
                            day_disabled: "opacity-50 cursor-not-allowed",
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {!formData.checkIn && (
                      <p className="mt-1 text-xs text-gray-500">Please select check-in date first</p>
                    )}
                    {bookedDates.includes(formData.checkOut) && (
                      <p className="mt-1 text-xs text-red-600 font-semibold flex items-center gap-1">
                        <span>🔴</span> This date is already booked
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Show booked date ranges */}
                {formData.roomType && bookedRanges.length > 0 && (
                  <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-2">📅 Already Booked Dates for {formData.roomType}:</p>
                    <div className="flex flex-wrap gap-2">
                      {bookedRanges.map((range, idx) => (
                        <span
                          key={idx}
                          className="inline-block rounded px-2 py-1 text-xs font-medium bg-amber-100 text-amber-800 border border-amber-300"
                        >
                          {new Date(range.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - {new Date(range.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-amber-700">Please avoid these dates when booking.</p>
                  </div>
                )}
                
                {/* Date Availability Status */}
                {formData.roomType && formData.checkIn && formData.checkOut && (
                  <div className="mb-6">
                    {dateAvailability.checking ? (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-600"></div>
                        <span>Checking availability...</span>
                      </div>
                    ) : !dateAvailability.available ? (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <strong>⚠ Not Available:</strong> {dateAvailability.message}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
                        <strong>✓ Available:</strong> These dates are available for booking.
                      </div>
                    )}
                  </div>
                )}
                
            <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Number of Guests *</label>
              <input
                type="number"
                      min="1"
                      max="10"
                      placeholder="1"
                value={formData.guests}
                onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Room Type / Selection *</label>
              <select
                      name="roomType"
                value={formData.roomType}
                onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              >
                <option value="">Select Room Type</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.name}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Special Requests / Notes <span className="text-gray-500 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    placeholder="e.g., extra bed, early check-in, dietary preferences..."
                    value={formData.specialRequests}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                  />
                </div>
                
                {/* reCAPTCHA */}
                {process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && (
                  <div className="mb-6 flex justify-center">
                    <ReCAPTCHA
                      ref={recaptchaRef}
                      sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY}
                      onChange={(token) => setRecaptchaToken(token)}
                      onExpired={() => {
                        setRecaptchaToken(null)
                        toast.warning("reCAPTCHA expired. Please verify again.")
                      }}
                      onError={() => {
                        setRecaptchaToken(null)
                        toast.error("reCAPTCHA error. Please try again.")
                      }}
                    />
                  </div>
                )}
                
            <button
              type="submit"
                  disabled={bookingSubmitting || !recaptchaToken || (formData.roomType && formData.checkIn && formData.checkOut && !dateAvailability.available)}
                  className="w-full bg-emerald-700 text-white py-3 rounded-lg hover:bg-emerald-800 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
                  {bookingSubmitting ? "Sending OTP..." : "Send OTP Verification"}
            </button>
              </>
            ) : (
              <>
                {/* Step 2: OTP Verification */}
                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-2">Step 2 of 2: Verify your email</p>
                  <p className="text-xs text-gray-500">
                    We've sent a 6-digit OTP code to <strong>{formData.email}</strong>
                  </p>
                </div>
                
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Enter OTP Code *</label>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={otpCode}
                    onChange={(e) => {
                      const newCode = e.target.value.replace(/\D/g, "")
                      setOtpCode(newCode)
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700 text-center text-2xl font-bold tracking-widest"
                    required
                    disabled={otpVerifying}
                    autoComplete="off"
                  />
                  {otpVerifying && (
                    <div className="mt-3 text-center">
                      <div className="inline-flex items-center gap-2 text-emerald-700">
                        <Loader2 size={20} className="animate-spin" />
                        <span className="text-sm font-semibold">Verifying & Booking...</span>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false)
                      setOtpCode("")
                    }}
                    className="mt-2 text-sm text-emerald-700 hover:text-emerald-800 underline"
                    disabled={otpVerifying}
                  >
                    Change email or resend OTP
                  </button>
                </div>
              </>
            )}
            
          </form>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className={`py-16 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-slate-900" : ""
      }`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            theme === "dark" ? "text-white" : "text-emerald-700"
          }`}>About {branding.name}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Premium Comfort",
                desc: "Experience ultimate luxury in every room with world-class amenities.",
              },
              { title: "Expert Service", desc: "Our dedicated staff ensures your stay is memorable and hassle-free." },
              {
                title: "Best Location",
                desc: "Centrally located with easy access to major attractions and restaurants.",
              },
            ].map((item, idx) => (
              <div key={idx} className={`p-8 rounded-lg text-center ${
                theme === "dark"
                  ? "bg-gradient-to-br from-slate-800 to-slate-700"
                  : "bg-gradient-to-br from-emerald-50 to-emerald-100"
              }`}>
                <h3 className={`text-xl font-bold mb-3 ${
                  theme === "dark" ? "text-emerald-400" : "text-emerald-700"
                }`}>{item.title}</h3>
                <p className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className={`py-16 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-slate-800" : "bg-gray-50"
      }`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            theme === "dark" ? "text-white" : "text-emerald-700"
          }`}>Contact Us</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center mb-6">
                <MapPin className={`mr-4 ${
                  theme === "dark" ? "text-emerald-400" : "text-emerald-700"
                }`} size={24} />
                <div>
                  <h3 className={`font-bold ${
                    theme === "dark" ? "text-white" : "text-gray-800"
                  }`}>Address</h3>
                  <p className={theme === "dark" ? "text-gray-400" : "text-gray-600"}>{branding.address || "123 Luxury Avenue, City Center"}</p>
                </div>
              </div>
              <div className="flex items-center mb-6">
                <Phone className={`mr-4 ${
                  theme === "dark" ? "text-emerald-400" : "text-emerald-700"
                }`} size={24} />
                <div>
                  <h3 className={`font-bold ${
                    theme === "dark" ? "text-white" : "text-gray-800"
                  }`}>Phone</h3>
                  <a href={`tel:${branding.phone || "+1 (555) 123-4567"}`} className={`transition ${
                    theme === "dark"
                      ? "text-gray-400 hover:text-emerald-400"
                      : "text-gray-600 hover:text-emerald-700"
                  }`}>
                    {branding.phone || "+1 (555) 123-4567"}
                  </a>
                </div>
              </div>
              <div className="flex items-center">
                <Mail className={`mr-4 ${
                  theme === "dark" ? "text-emerald-400" : "text-emerald-700"
                }`} size={24} />
                <div>
                  <h3 className={`font-bold ${
                    theme === "dark" ? "text-white" : "text-gray-800"
                  }`}>Email</h3>
                  <a href={`mailto:${branding.email || "info@luxestay.com"}`} className={`transition ${
                    theme === "dark"
                      ? "text-gray-400 hover:text-emerald-400"
                      : "text-gray-600 hover:text-emerald-700"
                  }`}>
                    {branding.email || "info@luxestay.com"}
                  </a>
                </div>
              </div>
            </div>
            <form onSubmit={handleContact} className="space-y-4">
              <input
                type="text"
                placeholder="Your Name"
                value={contact.name}
                onChange={(e) => setContact({ ...contact, name: e.target.value })}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === "dark"
                    ? "border-slate-600 bg-slate-700 text-white focus:ring-emerald-400"
                    : "border-gray-300 focus:ring-emerald-700"
                }`}
                required
              />
              <input
                type="email"
                placeholder="Your Email"
                value={contact.email}
                onChange={(e) => setContact({ ...contact, email: e.target.value })}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === "dark"
                    ? "border-slate-600 bg-slate-700 text-white focus:ring-emerald-400"
                    : "border-gray-300 focus:ring-emerald-700"
                }`}
                required
              />
              <textarea
                placeholder="Your Message"
                value={contact.message}
                onChange={(e) => setContact({ ...contact, message: e.target.value })}
                rows={4}
                className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === "dark"
                    ? "border-slate-600 bg-slate-700 text-white focus:ring-emerald-400"
                    : "border-gray-300 focus:ring-emerald-700"
                }`}
                required
              />
              <button
                type="submit"
                disabled={contactSubmitting}
                className="w-full bg-emerald-700 text-white py-3 rounded-lg hover:bg-emerald-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {contactSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Sending...
                  </>
                ) : (
                  <>
                <Send size={20} /> Send Message
                  </>
              )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className={`py-16 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-slate-900" : ""
      }`}>
        <div className="max-w-7xl mx-auto">
          <h2 className={`text-3xl md:text-4xl font-bold text-center mb-12 ${
            theme === "dark" ? "text-white" : "text-emerald-700"
          }`}>Guest Feedback</h2>
          {feedbacks.length === 0 ? (
            <div className="text-center py-12 mb-12">
              <p className={`text-lg ${
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              }`}>No feedback available</p>
            </div>
          ) : (
            <div className="relative mb-12">
              <div className="overflow-hidden">
                <div
                  className="flex transition-transform duration-500 ease-in-out"
                  style={{
                    transform: `translateX(-${currentFeedbackIndex * (100 / 3)}%)`,
                  }}
                >
            {feedbacks.map((fb) => (
                    <div
                      key={fb.id}
                      className="flex-shrink-0 w-full md:w-1/3 px-4"
                      style={{ minWidth: "33.333%" }}
                    >
                      <div className={`p-6 rounded-lg shadow-md hover:shadow-xl transition-all duration-300 hover:scale-105 h-full ${
                        theme === "dark"
                          ? "bg-slate-800 border border-slate-700"
                          : "bg-white border border-gray-100"
                      }`}>
                <div className="flex items-center mb-4">
                          {[...Array(fb.rating || 5)].map((_, i) => (
                    <Star key={i} size={18} className="text-amber-500 fill-amber-500" />
                  ))}
                </div>
                        <p className={`mb-4 line-clamp-4 ${
                          theme === "dark" ? "text-gray-300" : "text-gray-700"
                        }`}>"{fb.message || fb.text}"</p>
                <p className={`font-bold ${
                  theme === "dark" ? "text-emerald-400" : "text-emerald-700"
                }`}>{fb.name}</p>
                      </div>
              </div>
            ))}
          </div>
              </div>
              
              {/* Navigation dots */}
              {feedbacks.length > 3 && (
                <div className="flex justify-center gap-2 mt-6">
                  {Array.from({ length: Math.ceil(feedbacks.length / 3) }).map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentFeedbackIndex(index * 3)}
                      className={`h-2 rounded-full transition-all ${
                        Math.floor(currentFeedbackIndex / 3) === index
                          ? "bg-emerald-700 w-8"
                          : "bg-gray-300 w-2"
                      }`}
                      aria-label={`Go to feedback set ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className={`p-8 rounded-lg max-w-2xl mx-auto ${
            theme === "dark"
              ? "bg-gradient-to-r from-slate-800 to-slate-700"
              : "bg-gradient-to-r from-emerald-50 to-emerald-100"
          }`}>
            <h3 className={`text-2xl font-bold mb-6 text-center ${
              theme === "dark" ? "text-white" : "text-emerald-700"
            }`}>Share Your Feedback</h3>
            <form onSubmit={handleFeedback} className="space-y-4">
              <input
                type="text"
                placeholder="Your Name"
                value={feedback.name}
                onChange={(e) => setFeedback({ ...feedback, name: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
              <input
                type="email"
                placeholder="Your Email"
                value={feedback.email}
                onChange={(e) => setFeedback({ ...feedback, email: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
              <div>
                <label className="block text-gray-800 font-semibold mb-2">Rating</label>
                <select
                  value={feedback.rating}
                  onChange={(e) => setFeedback({ ...feedback, rating: Number.parseInt(e.target.value) })}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                >
                  {[1, 2, 3, 4, 5].map((num) => (
                    <option key={num} value={num}>
                      {num} Star{num !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Your Feedback"
                value={feedback.message}
                onChange={(e) => setFeedback({ ...feedback, message: e.target.value })}
                rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700"
                required
              />
              <button
                type="submit"
                disabled={feedbackSubmitting}
                className="w-full bg-emerald-700 text-white py-3 rounded-lg hover:bg-emerald-800 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {feedbackSubmitting ? (
                  <>
                    <Loader2 size={20} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-12 px-4 sm:px-6 lg:px-8 text-white ${
        theme === "dark" ? "bg-slate-900" : "bg-emerald-800"
      }`}>
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={branding.logo || "/placeholder-logo.png"}
                  alt={`${branding.name} logo`}
                  className="h-10 w-10 rounded-full object-cover border border-emerald-600"
                />
                <h4 className="font-bold text-lg">{branding.name}</h4>
              </div>
              <p className="text-emerald-100">{branding.tagline}</p>
            </div>
            <div>
              <h4 className="font-bold mb-4">Quick Links</h4>
              <ul className="space-y-2 text-emerald-100">
                <li>
                  <a
                    href="#home"
                    onClick={(e) => handleSmoothScroll(e, "home")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Home
                  </a>
                </li>
                <li>
                  <a
                    href="#rooms"
                    onClick={(e) => handleSmoothScroll(e, "rooms")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Rooms
                  </a>
                </li>
                <li>
                  <a
                    href="#booking"
                    onClick={(e) => handleSmoothScroll(e, "booking")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Booking
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Support</h4>
              <ul className="space-y-2 text-emerald-100">
                <li>
                  <a
                    href="#contact"
                    onClick={(e) => handleSmoothScroll(e, "contact")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    onClick={(e) => handleSmoothScroll(e, "contact")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    FAQ
                  </a>
                </li>
                <li>
                  <a 
                    href="#contact" 
                    onClick={(e) => handleSmoothScroll(e, "contact")}
                    className="hover:text-white transition cursor-pointer"
                  >
                    Terms
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Follow Us</h4>
              <div className="flex space-x-4 mb-4">
                {branding.facebook && (
                  <a href={branding.facebook} target="_blank" rel="noopener noreferrer" className="bg-emerald-700 p-2 rounded hover:bg-emerald-600 transition">
                  f
                </a>
                )}
                {branding.twitter && (
                  <a href={branding.twitter} target="_blank" rel="noopener noreferrer" className="bg-emerald-700 p-2 rounded hover:bg-emerald-600 transition">
                  𝕏
                </a>
                )}
                {branding.linkedin && (
                  <a href={branding.linkedin} target="_blank" rel="noopener noreferrer" className="bg-emerald-700 p-2 rounded hover:bg-emerald-600 transition">
                  in
                </a>
                )}
                {!branding.facebook && !branding.twitter && !branding.linkedin && (
                  <p className="text-emerald-100 text-sm">No social links configured</p>
                )}
              </div>
              {/* PWA Install Button */}
              <PWAInstallButton variant="footer" />
            </div>
          </div>
          <div className="border-t border-emerald-700 pt-8 text-center text-emerald-100">
            <p>&copy; 2025 {branding.name}. All rights reserved.</p>
          </div>
        </div>
      </footer>
      
      {/* PWA Install Banner (Fixed Bottom) */}
      <PWAInstallButton variant="footer-banner" />
      <Toaster position="top-center" richColors />
    </div>
  )
}
