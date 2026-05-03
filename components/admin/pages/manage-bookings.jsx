"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import {
  X,
  Undo2,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  DollarSign,
  Trash2,
  AlertTriangle,
  Printer,
  FileDown,
  Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { auth, db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, where } from "firebase/firestore"
import { toast } from "sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { buildBookingInvoiceHtml, printBookingInvoiceHtml } from "@/lib/booking-invoice-html"
import { downloadBookingInvoicePdf } from "@/lib/booking-invoice-pdf"
import { computeBookingInvoiceOpts } from "@/lib/booking-invoice-model"
import {
  calcNightsForInvoice as calcNights,
  getComputedTotalForInvoice as getComputedTotal,
  invoiceComputeHelpers,
} from "@/lib/booking-invoice-helpers"

/** Resort-owner bookings only; legacy helpdesk has no owner-scoped token for `/api/booking/send-invoice`. */
function canEmailInvoiceFromUi(isLegacyHelpdesk, ownerUid) {
  return !isLegacyHelpdesk && !!ownerUid
}

// Status priority for sorting
const STATUS_PRIORITY = {
  "Pending": 1,
  "Approved": 2,
  "Completed": 3,
  "Cancelled": 4,
  "Declined": 5,
}

const DEMO_BOOKINGS = [
  {
    id: "demo-001",
    isDemo: true,
    name: "Juan Dela Cruz",
    email: "juan@example.com",
    phone: "+63 912 345 6789",
    roomType: "Suite Room",
    checkIn: "2026-05-01",
    checkOut: "2026-05-03",
    guests: 2,
    status: "Pending",
    proofOfPaymentUrl:
      "https://images.unsplash.com/photo-1627384113972-f4c0392fe5ad?auto=format&fit=crop&w=1200&q=80",
    validIdUrl:
      "https://images.unsplash.com/photo-1627384113744-9eae9bdfb1ef?auto=format&fit=crop&w=1200&q=80",
    createdAt: new Date(),
  },
  {
    id: "demo-002",
    isDemo: true,
    name: "Maria Santos",
    email: "maria@example.com",
    phone: "+63 917 000 1234",
    roomType: "Deluxe Room",
    checkIn: "2026-05-10",
    checkOut: "2026-05-12",
    guests: 3,
    status: "Approved",
    proofOfPaymentUrl:
      "https://images.unsplash.com/photo-1554224154-22dec7ec8818?auto=format&fit=crop&w=1200&q=80",
    validIdUrl:
      "https://images.unsplash.com/photo-1618044733300-9472054094ee?auto=format&fit=crop&w=1200&q=80",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8),
  },
  {
    id: "demo-003",
    isDemo: true,
    name: "Alex Reyes",
    email: "alex@example.com",
    phone: "+63 905 111 2222",
    roomType: "Standard Room",
    checkIn: "2026-04-20",
    checkOut: "2026-04-22",
    guests: 1,
    status: "Completed",
    proofOfPaymentUrl:
      "https://images.unsplash.com/photo-1567427018141-0584cfcbf1b8?auto=format&fit=crop&w=1200&q=80",
    validIdUrl:
      "https://images.unsplash.com/photo-1618044733847-6f2a55d611b6?auto=format&fit=crop&w=1200&q=80",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26),
  },
]

function bookingBelongsToTenant(data, tenantOwnerUid) {
  if (tenantOwnerUid) return data.ownerUid === tenantOwnerUid
  return !data.ownerUid
}

export default function ManageBookings({
  isLegacyHelpdesk = true,
  ownerUid = null,
  invoiceBusiness = null,
}) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [deleteBooking, setDeleteBooking] = useState(null)
  const [declineBooking, setDeclineBooking] = useState(null)
  const [declineReason, setDeclineReason] = useState("")
  const [processingId, setProcessingId] = useState(null)
  /** Non-null = sending invoice email for that booking id */
  const [invoiceEmailBookingId, setInvoiceEmailBookingId] = useState(null)
  const invoiceEmailLockRef = useRef(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState("all")
  const isMobile = useIsMobile()
  const ITEMS_PER_PAGE = 10

  // Fetch bookings from Firestore (legacy = no ownerUid; resort owner = scoped)
  useEffect(() => {
    const bookingsRef = collection(db, "guestbooking")

    if (isLegacyHelpdesk) {
      const q = query(bookingsRef, orderBy("createdAt", "desc"))
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const bookingsData = snapshot.docs
            .map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }))
            .filter((b) => bookingBelongsToTenant(b, null))
          setBookings(bookingsData)
          setLoading(false)
        },
        (error) => {
          console.error("Error fetching bookings:", error)
          toast.error("Failed to load bookings")
          setLoading(false)
        },
      )
      return () => unsubscribe()
    }

    if (!ownerUid) {
      setBookings([])
      setLoading(false)
      return
    }

    const q = query(bookingsRef, where("ownerUid", "==", ownerUid))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const bookingsData = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() ?? 0
            const tb = b.createdAt?.toMillis?.() ?? 0
            return tb - ta
          })
        setBookings(bookingsData)
        setLoading(false)
      },
      (error) => {
        console.error("Error fetching bookings:", error)
        toast.error("Failed to load bookings")
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [isLegacyHelpdesk, ownerUid])

  const showDemo = !loading && bookings.length === 0
  const effectiveBookings = showDemo ? DEMO_BOOKINGS : bookings

  const formatPhp = (n) => {
    const v = Number(n || 0)
    if (!isFinite(v)) return "₱0"
    return `₱${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const handleDecline = async (booking) => {
    if (processingId) return // Prevent multiple clicks

    if (!booking || !booking.id || !booking.email) {
      toast.error("Invalid booking data")
      return
    }

    if (booking.isDemo) {
      toast.info("Demo row only — connect Firestore bookings to manage real requests.")
      return
    }

    setDeclineBooking(booking)
    setDeclineReason("")
  }

  const confirmDecline = async () => {
    if (!declineBooking || processingId) return
    if (!declineReason.trim()) {
      toast.error("Please enter a reason for decline.")
      return
    }

    setProcessingId(declineBooking.id)

    try {
      console.log("Declining booking:", declineBooking.id)

      // Update status in Firestore
      const updateResponse = await fetch("/api/booking/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: declineBooking.id,
          status: "Declined",
          reason: declineReason.trim(),
        }),
      })

      const updateData = await updateResponse.json()

      if (!updateResponse.ok) {
        throw new Error(updateData.error || "Failed to update booking status")
      }

      console.log("Status updated, sending email...")

      // Send decline email with reason
      try {
        const emailResponse = await fetch("/api/booking/send-status-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: declineBooking.email,
            name: declineBooking.name,
            roomType: declineBooking.roomType,
            checkIn: declineBooking.checkIn,
            checkOut: declineBooking.checkOut,
            status: "Declined",
            bookingId: declineBooking.id,
            reason: declineReason.trim(),
          }),
        })

        const emailData = await emailResponse.json()
        if (!emailResponse.ok) {
          console.error("Failed to send email:", emailData.error)
          toast.warning(`Booking declined, but email failed to send: ${emailData.error}`)
        } else {
          console.log("Email sent successfully")
          toast.success(`Booking declined. Email sent to ${declineBooking.email}`)
        }
      } catch (emailError) {
        console.error("Error sending email:", emailError)
        toast.warning(`Booking declined, but email failed to send: ${emailError.message}`)
      }
    } catch (error) {
      console.error("Error declining booking:", error)
      toast.error(error.message || "Failed to decline booking")
    } finally {
      setDeclineBooking(null)
      setDeclineReason("")
      setProcessingId(null)
    }
  }

  const handleMarkAsPaid = async (booking) => {
    if (processingId) return
    
    if (!booking || !booking.id) {
      toast.error("Invalid booking data")
      return
    }

    if (booking.isDemo) {
      toast.info("Demo row only — connect Firestore bookings to manage real requests.")
      return
    }
    
    setProcessingId(booking.id)
    
    try {
      console.log("Marking booking as paid:", booking.id)
      
      const response = await fetch("/api/booking/mark-as-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to mark booking as paid")
      }

      // Send approval email (no payment link; just confirmation)
      try {
        await fetch("/api/booking/send-status-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: booking.email,
            name: booking.name,
            roomType: booking.roomType,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            status: "Approved",
            bookingId: booking.id,
          }),
        })
      } catch (e) {
        console.warn("Approval email failed:", e?.message)
      }

      toast.success(`Paid & approved. Amount: ${formatPhp(data.paidAmount || 0)} (${data.nights || "?"} night(s))`)
    } catch (error) {
      console.error("Error marking booking as paid:", error)
      toast.error(error.message || "Failed to mark booking as paid")
    } finally {
      setProcessingId(null)
    }
  }

  const handleCancel = async (booking) => {
    if (processingId) return
    
    setProcessingId(booking.id)
    
    try {
      const updateResponse = await fetch("/api/booking/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          status: "Cancelled",
        }),
      })

      const updateData = await updateResponse.json()

      if (!updateResponse.ok) {
        throw new Error(updateData.error || "Failed to cancel booking")
      }

      // Send cancellation email
      try {
        await fetch("/api/booking/send-status-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: booking.email,
            name: booking.name,
            roomType: booking.roomType,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            status: "Cancelled",
            bookingId: booking.id,
          }),
        })
      } catch (emailError) {
        console.error("Error sending email:", emailError)
      }

      toast.success(`Booking cancelled. Email sent to ${booking.email}`)
    } catch (error) {
      console.error("Error cancelling booking:", error)
      toast.error(error.message || "Failed to cancel booking")
    } finally {
      setProcessingId(null)
    }
  }

  const handleDeleteClick = (booking) => {
    if (booking?.isDemo) {
      toast.info("Demo row only — nothing to delete.")
      return
    }
    setDeleteBooking(booking)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteBooking || processingId) return
    
    setProcessingId(deleteBooking.id)
    
    try {
      const bookingRef = doc(db, "guestbooking", deleteBooking.id)
      await deleteDoc(bookingRef)
      
      toast.success("Booking deleted successfully")
      setDeleteBooking(null)
    } catch (error) {
      console.error("Error deleting booking:", error)
      toast.error("Failed to delete booking")
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status) => {
    switch (status?.trim()) {
      case "Approved":
        return "bg-green-100 text-green-800"
      case "Pending":
        return "bg-yellow-100 text-yellow-800"
      case "Cancelled":
        return "bg-red-100 text-red-800"
      case "Declined":
        return "bg-red-100 text-red-800"
      case "Completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString + "T00:00:00")
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    } catch {
      return dateString
    }
  }

  const formatDateForExport = (dateString) => {
    if (!dateString) return "N/A"
    try {
      const date = new Date(dateString + "T00:00:00")
      return date.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })
    } catch {
      return dateString
    }
  }

  const getInvoiceOpts = (booking) =>
    computeBookingInvoiceOpts(booking, invoiceBusiness, invoiceComputeHelpers)

  const handleInvoicePrint = (booking) => {
    if (!booking) return
    const html = buildBookingInvoiceHtml(getInvoiceOpts(booking))
    printBookingInvoiceHtml(html)
  }

  const handleInvoiceDownload = (booking) => {
    if (!booking) return
    try {
      downloadBookingInvoicePdf(getInvoiceOpts(booking))
      toast.success("Na-download ang PDF invoice.")
    } catch (e) {
      console.error(e)
      toast.error("Hindi ma-generate ang PDF. Subukan ulit.")
    }
  }

  const handleInvoiceEmailGuest = async (booking) => {
    if (!booking?.id || invoiceEmailLockRef.current) return
    if (booking.isDemo) {
      toast.info("Demo row only — walang email ang demo booking.")
      return
    }
    if (!String(booking.email || "").trim()) {
      toast.error("Walang email ang guest sa booking na ito.")
      return
    }
    if (!canEmailInvoiceFromUi(isLegacyHelpdesk, ownerUid)) {
      toast.error("Email invoice ay para sa resort dashboard lamang (may owner account).")
      return
    }
    const user = auth.currentUser
    if (!user) {
      toast.error("Mag-sign in muna bilang resort owner.")
      return
    }
    invoiceEmailLockRef.current = true
    setInvoiceEmailBookingId(booking.id)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch("/api/booking/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, idToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || res.statusText || "Request failed")
      }
      toast.success(`Naipadala ang invoice sa ${String(booking.email).trim()}.`)
    } catch (e) {
      console.error(e)
      toast.error(e?.message || "Hindi maipadala ang invoice. Subukan ulit.")
    } finally {
      invoiceEmailLockRef.current = false
      setInvoiceEmailBookingId(null)
    }
  }

  const invoiceMailUiDisabled = (booking) =>
    !booking ||
    booking.isDemo ||
    !String(booking.email || "").trim() ||
    !canEmailInvoiceFromUi(isLegacyHelpdesk, ownerUid) ||
    (invoiceEmailBookingId !== null && invoiceEmailBookingId !== booking.id)

  const invoiceMailUiBusy = (booking) => invoiceEmailBookingId === booking?.id

  const exportToExcel = () => {
    try {
      // Prepare data for export
      const exportData = sortedAndFilteredBookings.map((booking, index) => {
        const createdAt = booking.createdAt?.toDate 
          ? booking.createdAt.toDate() 
          : booking.createdAt 
          ? new Date(booking.createdAt) 
          : new Date()
        
        return {
          "No.": index + 1,
          "Booking ID": booking.id || "N/A",
          "Guest Name": booking.name || "N/A",
          "Email": booking.email || "N/A",
          "Phone": booking.phone || "N/A",
          "Room Type": booking.roomType || "N/A",
          "Check-in": formatDateForExport(booking.checkIn),
          "Check-out": formatDateForExport(booking.checkOut),
          "Guests": booking.guests || "N/A",
          "Status": booking.status?.trim() || "Pending",
          "Payment Status": booking.paymentStatus || "unpaid",
          "Paid Amount": booking.paidAmount ? `₱${booking.paidAmount.toFixed(2)}` : "N/A",
          "Special Requests": booking.specialRequests || "None",
          "Created At": createdAt.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
          "Updated At": booking.updatedAt?.toDate 
            ? booking.updatedAt.toDate().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "N/A",
        }
      })

      // Convert to CSV format (Excel-compatible)
      const headers = Object.keys(exportData[0] || {})
      const csvHeaders = headers.join(",")
      
      const csvRows = exportData.map((row) => {
        return headers.map((header) => {
          const value = row[header] || ""
          // Escape commas and quotes in CSV
          if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(",")
      })

      const csvContent = [csvHeaders, ...csvRows].join("\n")
      
      // Add BOM for Excel UTF-8 support
      const BOM = "\uFEFF"
      const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" })
      
      // Create download link
      const link = document.createElement("a")
      const today = new Date().toISOString().split("T")[0]
      const filename = `bookings-export-${today}.csv`
      link.href = URL.createObjectURL(blob)
      link.download = filename
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success(`Exported ${exportData.length} bookings to ${filename}`)
    } catch (error) {
      console.error("Error exporting bookings:", error)
      toast.error("Failed to export bookings. Please try again.")
    }
  }

  // Sort and filter bookings
  const sortedAndFilteredBookings = useMemo(() => {
    let filtered = [...effectiveBookings]

    // Filter by status
    if (sortBy !== "all") {
      filtered = filtered.filter((booking) => booking.status?.trim() === sortBy)
    }

    // Sort by status priority, then by createdAt
    filtered.sort((a, b) => {
      const statusA = a.status?.trim() || "Pending"
      const statusB = b.status?.trim() || "Pending"
      const priorityA = STATUS_PRIORITY[statusA] || 99
      const priorityB = STATUS_PRIORITY[statusB] || 99

      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }

      // If same priority, sort by createdAt (newest first)
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0)
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0)
      return dateB - dateA
    })

    return filtered
  }, [effectiveBookings, sortBy])

  // Pagination calculations
  const totalPages = Math.ceil(sortedAndFilteredBookings.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedBookings = sortedAndFilteredBookings.slice(startIndex, endIndex)

  // Reset to page 1 when sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy])

  // Skeleton loading component
  const SkeletonRow = () => (
    <tr className="border-b border-border">
      <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-24" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-40" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-32" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-20" /></td>
      <td className="py-4 px-6"><Skeleton className="h-4 w-16" /></td>
      <td className="py-4 px-6"><Skeleton className="h-6 w-20 rounded-full" /></td>
      <td className="py-4 px-6"><Skeleton className="h-8 w-24" /></td>
    </tr>
  )

  const MobileSkeletonCard = () => (
    <div className="bg-card rounded-xl shadow-lg p-4 border border-border">
      <div className="flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex gap-2 shrink-0">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
      </div>
      </div>
    )

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-foreground">Manage Bookings</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={exportToExcel}
            className="bg-emerald-700 hover:bg-emerald-800 text-white"
            disabled={loading || sortedAndFilteredBookings.length === 0 || showDemo}
          >
            <Download size={16} className="mr-2" />
            Export to Excel
          </Button>
          <label className="text-sm text-muted-foreground whitespace-nowrap">Sort by:</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Approved">Approved</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {sortedAndFilteredBookings.length === 0 ? (
        <div className="bg-card rounded-xl shadow-lg p-8 text-center">
          <p className="text-muted-foreground">No bookings found.</p>
        </div>
      ) : isMobile ? (
        // Mobile View: Name and Actions only
        <div className="space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <MobileSkeletonCard key={i} />)
          ) : (
            paginatedBookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-card rounded-xl shadow-lg p-4 border border-border hover:shadow-xl transition-shadow"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">{booking.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{booking.email}</p>
                    <p className="mt-1 text-xs font-semibold text-foreground">
                      {formatPhp(getComputedTotal(booking))}
                      {booking.paymentStatus === "paid" && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Paid
                        </span>
                      )}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                      {booking.status?.trim() || "Pending"}
                    </span>
                  </div>
                <div className="flex gap-2 shrink-0">
                  {booking.paymentStatus !== "paid" && booking.status?.trim() !== "Declined" && booking.status?.trim() !== "Cancelled" && (
                    <button
                      onClick={() => handleMarkAsPaid(booking)}
                      disabled={processingId === booking.id}
                      className="p-2 bg-blue-100 text-blue-800 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      title="Mark as Paid (auto-approve)"
                    >
                      {processingId === booking.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <DollarSign size={18} />
                      )}
                    </button>
                  )}
                  {booking.status?.trim() === "Pending" && (
                    <button
                      onClick={() => handleDecline(booking)}
                      disabled={processingId === booking.id}
                      className="p-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      title="Decline"
                    >
                      {processingId === booking.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <X size={18} />
                      )}
                    </button>
                  )}
                  {booking.status?.trim() === "Approved" && (
                    <button
                      onClick={() => handleCancel(booking)}
                      disabled={processingId === booking.id}
                      className="p-2 bg-orange-100 text-orange-800 rounded-lg hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      title="Cancel"
                    >
                      {processingId === booking.id ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Undo2 size={18} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedBooking(booking)}
                    className="p-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition"
                    title="View Details"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInvoiceEmailGuest(booking)}
                    disabled={invoiceMailUiDisabled(booking)}
                    className="p-2 bg-teal-100 text-teal-800 rounded-lg hover:bg-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    title={
                      !canEmailInvoiceFromUi(isLegacyHelpdesk, ownerUid)
                        ? "Resort owner dashboard only"
                        : "I-email ang invoice sa guest"
                    }
                  >
                    {invoiceMailUiBusy(booking) ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Mail size={18} />
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteClick(booking)}
                    disabled={processingId === booking.id}
                    className="p-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Booking"
                  >
                    {processingId === booking.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      ) : (
        // Desktop View: Table
      <div className="bg-card rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Guest Name</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Booking ID</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Email</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Room Type</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Check-in / Check-out</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Guests</th>
                  <th className="text-left py-4 px-6 font-semibold text-foreground">Amount</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Status</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
                {loading ? (
                  Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                ) : (
                  paginatedBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-border hover:bg-secondary/10 transition-colors">
                    <td className="py-4 px-6">
                      <span className="font-medium text-foreground">{booking.name}</span>
                    </td>
                    <td className="py-4 px-6 font-mono text-xs text-foreground">{booking.id.substring(0, 8)}...</td>
                    <td className="py-4 px-6 text-foreground text-xs">{booking.email}</td>
                    <td className="py-4 px-6 text-foreground">{booking.roomType}</td>
                  <td className="py-4 px-6 text-muted-foreground text-xs">
                      {formatDate(booking.checkIn)} <br />
                      <span className="text-muted-foreground/70">to {formatDate(booking.checkOut)}</span>
                  </td>
                    <td className="py-4 px-6 text-foreground">{booking.guests}</td>
                    <td className="py-4 px-6">
                      <span className="font-semibold text-foreground">{formatPhp(getComputedTotal(booking))}</span>
                      {booking.paymentStatus === "paid" && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          Paid
                        </span>
                      )}
                    </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                        {booking.status?.trim() || "Pending"}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex gap-2">
                        {booking.paymentStatus !== "paid" && booking.status?.trim() !== "Declined" && booking.status?.trim() !== "Cancelled" && (
                          <button
                            onClick={() => handleMarkAsPaid(booking)}
                            disabled={processingId === booking.id}
                            className="p-2 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            title="Mark as Paid (auto-approve)"
                          >
                            {processingId === booking.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <DollarSign size={16} />
                            )}
                          </button>
                        )}
                        {booking.status?.trim() === "Pending" && (
                          <button
                            onClick={() => handleDecline(booking)}
                            disabled={processingId === booking.id}
                            className="p-2 bg-red-100 text-red-800 rounded hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            title="Decline"
                          >
                            {processingId === booking.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <X size={16} />
                            )}
                          </button>
                        )}
                        {booking.status?.trim() === "Approved" && (
                          <button
                            onClick={() => handleCancel(booking)}
                            disabled={processingId === booking.id}
                            className="p-2 bg-orange-100 text-orange-800 rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            title="Cancel"
                          >
                            {processingId === booking.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Undo2 size={16} />
                            )}
                          </button>
                        )}
                        <button
                        onClick={() => setSelectedBooking(booking)}
                          className="p-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInvoiceEmailGuest(booking)}
                        disabled={invoiceMailUiDisabled(booking)}
                        className="p-2 bg-teal-100 text-teal-800 rounded hover:bg-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        title={
                          !canEmailInvoiceFromUi(isLegacyHelpdesk, ownerUid)
                            ? "Resort owner dashboard only"
                            : "I-email ang invoice sa guest"
                        }
                      >
                        {invoiceMailUiBusy(booking) ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Mail size={16} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(booking)}
                        disabled={processingId === booking.id}
                        className="p-2 bg-red-100 text-red-800 rounded hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Delete Booking"
                      >
                        {processingId === booking.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
                  ))
                )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Pagination */}
      {sortedAndFilteredBookings.length > ITEMS_PER_PAGE && (
        <div className="mt-6 flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) setCurrentPage(currentPage - 1)
                  }}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                // Show first page, last page, current page, and pages around current
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <PaginationItem key={page}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          setCurrentPage(page)
                        }}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  )
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return (
                    <PaginationItem key={page}>
                      <span className="px-2">...</span>
                    </PaginationItem>
                  )
                }
                return null
              })}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) setCurrentPage(currentPage + 1)
                  }}
                  className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}

      {/* Show pagination info */}
      {sortedAndFilteredBookings.length > 0 && (
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Showing {startIndex + 1} to {Math.min(endIndex, sortedAndFilteredBookings.length)} of {sortedAndFilteredBookings.length} bookings
        </div>
      )}

      <Dialog open={!!selectedBooking} onOpenChange={(open) => !open && setSelectedBooking(null)}>
        <DialogContent className={`${isMobile ? 'max-w-[95%] w-[95%] max-h-[90vh] p-4' : 'max-w-2xl max-h-[90vh] p-6'} overflow-y-auto`}>
      {selectedBooking && (
            <>
              <DialogHeader className={isMobile ? 'pb-2' : 'pb-4'}>
                <DialogTitle className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold text-foreground`}>
                  Booking Details
                </DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {selectedBooking.email}
                </DialogDescription>
              </DialogHeader>
              
            <div className="space-y-4">
                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Booking ID</p>
                    <p className={`font-semibold text-foreground font-mono ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {selectedBooking.id?.substring(0, 8) || selectedBooking.id}
                    </p>
                </div>
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Status</p>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold inline-block ${getStatusColor(selectedBooking.status)}`}
                  >
                    {selectedBooking.status?.trim() || "Pending"}
                  </span>
                </div>
              </div>
              
              <div>
                  <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Guest Name</p>
                  <p className={`font-semibold text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
                    {selectedBooking.name}
                  </p>
              </div>
              
                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Email</p>
                    <p className={`font-semibold text-foreground ${isMobile ? 'text-xs' : 'text-sm'} break-all`}>
                      {selectedBooking.email}
                    </p>
                </div>
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Phone</p>
                    <p className={`font-semibold text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {selectedBooking.phone || "N/A"}
                    </p>
                  </div>
              </div>
              
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Room Type</p>
                  <p className={`font-semibold text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
                    {selectedBooking.roomType || "N/A"}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3">
                  <p className={`${isMobile ? "text-[10px]" : "text-xs"} text-muted-foreground mb-2 font-semibold uppercase tracking-wide`}>
                    Invoice amount
                  </p>
                  <div className={`flex flex-wrap items-end justify-between gap-2 ${isMobile ? "flex-col items-start" : ""}`}>
                    <div className="text-sm text-muted-foreground">
                      {Number(selectedBooking.pricePerNight || 0) > 0 &&
                      (Number(selectedBooking.nights || 0) > 0 ||
                        calcNights(selectedBooking.checkIn, selectedBooking.checkOut) > 0) ? (
                        <>
                          <span className="font-medium text-foreground">
                            {formatPhp(Number(selectedBooking.pricePerNight || 0))}
                          </span>{" "}
                          ×{" "}
                          {Number(selectedBooking.nights || 0) ||
                            calcNights(selectedBooking.checkIn, selectedBooking.checkOut)}{" "}
                          night(s)
                        </>
                      ) : (
                        <span>Total due / recorded</span>
                      )}
                    </div>
                    <p className={`font-bold text-foreground ${isMobile ? "text-xl" : "text-2xl"}`}>
                      {formatPhp(getComputedTotal(selectedBooking))}
                    </p>
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    May watermark ng resort name ang invoice. I-print o mag-download ng PDF sa ibaba.
                  </p>
                </div>
                
                <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-3'} gap-4`}>
                  <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Check-in</p>
                    <p className={`font-semibold text-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {formatDate(selectedBooking.checkIn)}
                    </p>
                </div>
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Check-out</p>
                    <p className={`font-semibold text-foreground ${isMobile ? 'text-xs' : 'text-sm'}`}>
                      {formatDate(selectedBooking.checkOut)}
                    </p>
                </div>
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Guests</p>
                    <p className={`font-semibold text-foreground ${isMobile ? 'text-sm' : 'text-base'}`}>
                      {selectedBooking.guests || "N/A"}
                    </p>
                </div>
              </div>
              
              {selectedBooking.specialRequests && (
                <div>
                    <p className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground mb-1`}>Special Requests</p>
                    <p className={`font-semibold text-foreground ${isMobile ? 'text-xs' : 'text-sm'} break-words`}>
                      {selectedBooking.specialRequests}
                    </p>
                </div>
              )}

              {(selectedBooking.proofOfPaymentUrl || selectedBooking.validIdUrl) && (
                <div className="pt-2 border-t border-border">
                  <p className={`${isMobile ? "text-[10px]" : "text-xs"} text-muted-foreground mb-2`}>
                    Payment attachments
                  </p>
                  <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-foreground mb-2">Proof of payment</p>
                      {selectedBooking.proofOfPaymentUrl ? (
                        <a
                          href={selectedBooking.proofOfPaymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                          title="Open proof of payment"
                        >
                          <img
                            src={selectedBooking.proofOfPaymentUrl}
                            alt="Proof of payment"
                            className="h-44 w-full rounded-md border border-border bg-white object-contain"
                            loading="lazy"
                          />
                          <p className="mt-2 text-[11px] text-emerald-700 underline break-all">Open image</p>
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not provided.</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-xs font-semibold text-foreground mb-2">Valid ID</p>
                      {selectedBooking.validIdUrl ? (
                        <a
                          href={selectedBooking.validIdUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block"
                          title="Open valid ID"
                        >
                          <img
                            src={selectedBooking.validIdUrl}
                            alt="Valid ID"
                            className="h-44 w-full rounded-md border border-border bg-white object-contain"
                            loading="lazy"
                          />
                          <p className="mt-2 text-[11px] text-emerald-700 underline break-all">Open image</p>
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not provided.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              </div>
              
              <DialogFooter
                className={`${isMobile ? "flex-col gap-2 mt-4" : "mt-6"} flex flex-wrap gap-2 sm:justify-end`}
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleInvoicePrint(selectedBooking)}
                  className={`gap-2 ${isMobile ? "w-full" : ""}`}
                >
                  <Printer className="h-4 w-4 shrink-0" />
                  Print invoice
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleInvoiceDownload(selectedBooking)}
                  className={`gap-2 ${isMobile ? "w-full" : ""}`}
                >
                  <FileDown className="h-4 w-4 shrink-0" />
                  Download PDF
                </Button>
                <Button
                  onClick={() => setSelectedBooking(null)}
                  className={`${isMobile ? "w-full" : ""} bg-primary hover:bg-primary/90 text-primary-foreground`}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
      )}
        </DialogContent>
      </Dialog>

      {/* Decline Reason Modal */}
      <Dialog open={!!declineBooking} onOpenChange={(open) => !open && setDeclineBooking(null)}>
        <DialogContent className={`${isMobile ? 'max-w-[95%] w-[95%] p-4' : 'max-w-lg p-6'}`}>
          <DialogHeader className={isMobile ? 'pb-2' : 'pb-4'}>
            <DialogTitle className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-foreground`}>
              Decline booking
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Add a reason to send to the guest.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {declineBooking?.name} <span className="text-muted-foreground font-normal">({declineBooking?.email})</span>
            </p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              rows={4}
              placeholder="e.g. Selected dates are no longer available."
              className="w-full rounded-lg border border-border bg-background px-4 py-2 text-sm text-foreground"
            />
            <p className="text-xs text-muted-foreground">This will be included in the decline email.</p>
          </div>

          <DialogFooter className={isMobile ? 'flex-col gap-2 mt-4' : 'mt-6'}>
            <Button
              onClick={() => setDeclineBooking(null)}
              className={`${isMobile ? 'w-full' : ''} bg-secondary text-secondary-foreground hover:bg-secondary/80`}
              disabled={processingId === declineBooking?.id}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDecline}
              className={`${isMobile ? 'w-full' : ''} bg-red-600 hover:bg-red-700 text-white`}
              disabled={processingId === declineBooking?.id}
            >
              {processingId === declineBooking?.id ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Declining…
                </span>
              ) : (
                "Decline & email guest"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={!!deleteBooking} onOpenChange={(open) => !open && setDeleteBooking(null)}>
        <AlertDialogContent className={`${isMobile ? 'max-w-[90%] w-[90%]' : 'max-w-md'}`}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete Booking
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this booking from <strong>{deleteBooking?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isMobile ? 'flex-col gap-2' : ''}>
            <AlertDialogCancel
              onClick={() => setDeleteBooking(null)}
              className={isMobile ? 'w-full' : ''}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={processingId === deleteBooking?.id}
              className={`bg-red-600 hover:bg-red-700 text-white ${isMobile ? 'w-full' : ''}`}
            >
              {processingId === deleteBooking?.id ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  Deleting...
                </span>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
