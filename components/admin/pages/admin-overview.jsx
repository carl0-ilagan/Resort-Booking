"use client"

import { useState, useEffect, useMemo } from "react"
import { Users, DoorOpen, BookOpen, DollarSign, MessageSquare, CheckCircle, TrendingUp } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/firebase"
import { collection, query, orderBy, onSnapshot } from "firebase/firestore"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Legend } from "recharts"

export default function AdminOverview() {
  const [loading, setLoading] = useState(true)
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [feedbacks, setFeedbacks] = useState([])
  const [revenueData, setRevenueData] = useState([])
  const [chartView, setChartView] = useState("day")

  // Auto-complete bookings that are paid and past check-out date
  useEffect(() => {
    const autoCompleteBookings = async () => {
      try {
        const response = await fetch("/api/booking/auto-complete", {
          method: "POST",
        })
        const data = await response.json()
        if (data.success && data.completed > 0) {
          console.log(`✅ Auto-completed ${data.completed} booking(s)`)
        }
      } catch (error) {
        console.error("Error auto-completing bookings:", error)
      }
    }

    // Run auto-complete when component mounts and every 5 minutes
    autoCompleteBookings()
    const interval = setInterval(autoCompleteBookings, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  // Fetch all data from Firestore
  useEffect(() => {
    let loadedCount = 0
    const totalSources = 3 // rooms, bookings, feedbacks

    const checkAllLoaded = () => {
      loadedCount++
      if (loadedCount >= totalSources) {
        setLoading(false)
      }
    }

    // Fetch rooms
    const roomsRef = collection(db, "rooms")
    const unsubscribeRooms = onSnapshot(
      roomsRef,
      (snapshot) => {
        const roomsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        console.log("Rooms loaded:", roomsData.length)
        setRooms(roomsData)
        checkAllLoaded()
      },
      (error) => {
        console.error("Error fetching rooms:", error)
        checkAllLoaded()
      }
    )

    // Fetch bookings
    const bookingsRef = collection(db, "guestbooking")
    let unsubscribeBookings
    
    try {
      const q = query(bookingsRef, orderBy("createdAt", "desc"))
      unsubscribeBookings = onSnapshot(
        q,
        (snapshot) => {
          const bookingsData = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : (data.paidAt ? new Date(data.paidAt) : null),
            }
          })
          console.log("Bookings loaded:", bookingsData.length, "Sample:", bookingsData[0])
          setBookings(bookingsData)
          checkAllLoaded()
        },
        (error) => {
          console.error("Error fetching bookings with orderBy:", error)
          // Fallback: fetch without orderBy
          const fallbackUnsubscribe = onSnapshot(
            bookingsRef,
            (snapshot) => {
              const bookingsData = snapshot.docs.map((doc) => {
                const data = doc.data()
                return {
                  id: doc.id,
                  ...data,
                  createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
                  paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : (data.paidAt ? new Date(data.paidAt) : null),
                }
              }).sort((a, b) => {
                const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
                const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
                return dateB - dateA
              })
              console.log("Bookings loaded (fallback):", bookingsData.length)
              setBookings(bookingsData)
              checkAllLoaded()
            },
            (fallbackError) => {
              console.error("Error fetching bookings (fallback):", fallbackError)
              checkAllLoaded()
            }
          )
          unsubscribeBookings = fallbackUnsubscribe
        }
      )
    } catch (queryError) {
      console.error("Error creating bookings query:", queryError)
      // Fallback without orderBy
      unsubscribeBookings = onSnapshot(
        bookingsRef,
        (snapshot) => {
          const bookingsData = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
              paidAt: data.paidAt?.toDate ? data.paidAt.toDate() : (data.paidAt ? new Date(data.paidAt) : null),
            }
          }).sort((a, b) => {
            const dateA = a.createdAt instanceof Date ? a.createdAt.getTime() : 0
            const dateB = b.createdAt instanceof Date ? b.createdAt.getTime() : 0
            return dateB - dateA
          })
          console.log("Bookings loaded (no orderBy):", bookingsData.length)
          setBookings(bookingsData)
          checkAllLoaded()
        },
        (error) => {
          console.error("Error fetching bookings:", error)
          checkAllLoaded()
        }
      )
    }

    // Fetch feedbacks
    const feedbacksRef = collection(db, "feedbacks")
    const unsubscribeFeedbacks = onSnapshot(
      feedbacksRef,
      (snapshot) => {
        const feedbacksData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        console.log("Feedbacks loaded:", feedbacksData.length)
        setFeedbacks(feedbacksData)
        checkAllLoaded()
      },
      (error) => {
        console.error("Error fetching feedbacks:", error)
        checkAllLoaded()
      }
    )

    return () => {
      unsubscribeRooms()
      unsubscribeBookings()
      unsubscribeFeedbacks()
    }
  }, [])

  // Calculate revenue data
  useEffect(() => {
    const calculateRevenue = async () => {
      if (bookings.length === 0 || rooms.length === 0) {
        setRevenueData([])
        return
      }

      try {
        // Create a map of room prices
        const roomPriceMap = new Map()
        rooms.forEach((room) => {
          const key = room.type?.trim() || room.name?.trim() || ""
          if (key) {
            const price = room.price || 0
            const discount = room.discount || 0
            const finalPrice = discount > 0 ? price * (1 - discount / 100) : price
            roomPriceMap.set(key.toLowerCase(), finalPrice)
          }
        })

        // Separate bookings by payment status
        const paidBookings = bookings.filter(
          (booking) => booking.paymentStatus === "paid"
        )

        const approvedBookings = bookings.filter(
          (booking) => booking.status?.trim() === "Approved" && booking.paymentStatus !== "paid"
        )

        // Calculate revenue per booking and group by date
        const actualRevenueByDate = new Map()
        const estimatedRevenueByDate = new Map()

        // Process paid bookings (actual revenue)
        for (const booking of paidBookings) {
          const checkIn = booking.checkIn
          const checkOut = booking.checkOut
          const paidAt = booking.paidAt?.toDate?.() || booking.paidAt || booking.createdAt

          if (!checkIn || !checkOut) continue

          // Use paid amount if available, otherwise calculate
          let totalAmount = booking.paidAmount || 0

          if (totalAmount === 0) {
            const roomType = booking.roomType?.trim() || ""
            const pricePerNight = roomPriceMap.get(roomType.toLowerCase()) || 0
            if (pricePerNight === 0) continue

            const checkInDate = new Date(checkIn)
            const checkOutDate = new Date(checkOut)
            const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
            if (nights <= 0) continue
            totalAmount = pricePerNight * nights
          }

          const dateKey = paidAt.toISOString().split("T")[0]
          const existing = actualRevenueByDate.get(dateKey) || 0
          actualRevenueByDate.set(dateKey, existing + totalAmount)
        }

        // Process approved bookings (estimated revenue)
        for (const booking of approvedBookings) {
          const roomType = booking.roomType?.trim() || ""
          const checkIn = booking.checkIn
          const checkOut = booking.checkOut
          const createdAt = booking.createdAt

          if (!checkIn || !checkOut) continue

          const pricePerNight = roomPriceMap.get(roomType.toLowerCase()) || 0
          if (pricePerNight === 0) continue

          const checkInDate = new Date(checkIn)
          const checkOutDate = new Date(checkOut)
          const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
          if (nights <= 0) continue

          const totalAmount = pricePerNight * nights
          const dateKey = createdAt.toISOString().split("T")[0]
          const existing = estimatedRevenueByDate.get(dateKey) || 0
          estimatedRevenueByDate.set(dateKey, existing + totalAmount)
        }

        // Combine and sort by date
        const allDates = new Set([
          ...Array.from(actualRevenueByDate.keys()),
          ...Array.from(estimatedRevenueByDate.keys()),
        ])

        const revenueArray = Array.from(allDates)
          .map((date) => ({
            date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            actualRevenue: Math.round((actualRevenueByDate.get(date) || 0) * 100) / 100,
            estimatedRevenue: Math.round((estimatedRevenueByDate.get(date) || 0) * 100) / 100,
            fullDate: date,
          }))
          .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate))

        // Group by view type
        let groupedData = []
        if (chartView === "week") {
          // Group by week
          const weekMap = new Map()
          revenueArray.forEach((item) => {
            const date = new Date(item.fullDate)
            const weekStart = new Date(date)
            weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
            const weekKey = weekStart.toISOString().split("T")[0]
            
            const existing = weekMap.get(weekKey) || { actualRevenue: 0, estimatedRevenue: 0, fullDate: weekKey }
            existing.actualRevenue += item.actualRevenue
            existing.estimatedRevenue += item.estimatedRevenue
            weekMap.set(weekKey, existing)
          })
          
          groupedData = Array.from(weekMap.entries())
            .map(([date, data]) => ({
              date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              actualRevenue: Math.round(data.actualRevenue * 100) / 100,
              estimatedRevenue: Math.round(data.estimatedRevenue * 100) / 100,
              fullDate: date,
            }))
            .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate))
            .slice(-12) // Last 12 weeks
        } else if (chartView === "month") {
          // Group by month
          const monthMap = new Map()
          revenueArray.forEach((item) => {
            const date = new Date(item.fullDate)
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
            
            const existing = monthMap.get(monthKey) || { actualRevenue: 0, estimatedRevenue: 0, fullDate: monthKey }
            existing.actualRevenue += item.actualRevenue
            existing.estimatedRevenue += item.estimatedRevenue
            monthMap.set(monthKey, existing)
          })
          
          groupedData = Array.from(monthMap.entries())
            .map(([date, data]) => ({
              date: new Date(date + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              actualRevenue: Math.round(data.actualRevenue * 100) / 100,
              estimatedRevenue: Math.round(data.estimatedRevenue * 100) / 100,
              fullDate: date,
            }))
            .sort((a, b) => new Date(a.fullDate) - new Date(b.fullDate))
            .slice(-12) // Last 12 months
        } else {
          // Day view - last 30 days
          groupedData = revenueArray.slice(-30)
        }

        setRevenueData(groupedData)
      } catch (error) {
        console.error("Error calculating revenue:", error)
        setRevenueData([])
      }
    }

    calculateRevenue()
  }, [bookings, rooms, chartView])

  // Calculate stats
  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const bookingsToday = bookings.filter((booking) => {
      if (!booking.createdAt) return false
      const bookingDate = booking.createdAt instanceof Date ? booking.createdAt : new Date(booking.createdAt)
      return bookingDate >= today
    })

    const pendingBookings = bookings.filter(
      (booking) => booking.status?.trim() === "Pending"
    )

    const completedBookings = bookings.filter(
      (booking) => booking.status?.trim() === "Completed"
    )

    // Calculate actual revenue (from paid bookings)
    let actualRevenue = 0
    const roomPriceMap = new Map()
    rooms.forEach((room) => {
      const key = room.type?.trim() || room.name?.trim() || ""
      if (key) {
        const price = room.price || 0
        const discount = room.discount || 0
        const finalPrice = discount > 0 ? price * (1 - discount / 100) : price
        roomPriceMap.set(key.toLowerCase(), finalPrice)
      }
    })

    const paidBookings = bookings.filter(
      (booking) => booking.paymentStatus === "paid"
    )

    paidBookings.forEach((booking) => {
      // Use paid amount if available
      if (booking.paidAmount) {
        actualRevenue += booking.paidAmount
      } else {
        // Calculate from booking details
        const roomType = booking.roomType?.trim() || ""
        const checkIn = booking.checkIn
        const checkOut = booking.checkOut

        if (!checkIn || !checkOut) return

        const pricePerNight = roomPriceMap.get(roomType.toLowerCase()) || 0
        if (pricePerNight === 0) return

        const checkInDate = new Date(checkIn)
        const checkOutDate = new Date(checkOut)
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
        
        if (nights > 0) {
          actualRevenue += pricePerNight * nights
        }
      }
    })

    // Calculate estimated revenue (from approved but not paid bookings)
    let estimatedRevenue = 0
    const approvedBookings = bookings.filter(
      (booking) => booking.status?.trim() === "Approved" && booking.paymentStatus !== "paid"
    )

    approvedBookings.forEach((booking) => {
      const roomType = booking.roomType?.trim() || ""
      const checkIn = booking.checkIn
      const checkOut = booking.checkOut

      if (!checkIn || !checkOut) return

      const pricePerNight = roomPriceMap.get(roomType.toLowerCase()) || 0
      if (pricePerNight === 0) return

      const checkInDate = new Date(checkIn)
      const checkOutDate = new Date(checkOut)
      const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24))
      
      if (nights > 0) {
        estimatedRevenue += pricePerNight * nights
      }
    })

    const statsResult = {
      totalRooms: rooms.length,
      bookingsToday: bookingsToday.length,
      pendingApproval: pendingBookings.length,
      completed: completedBookings.length,
      actualRevenue: actualRevenue,
      estimatedRevenue: estimatedRevenue,
      totalFeedback: feedbacks.length,
    }

    console.log("Dashboard Stats Calculated:", {
      totalRooms: statsResult.totalRooms,
      bookingsToday: statsResult.bookingsToday,
      pendingApproval: statsResult.pendingApproval,
      completed: statsResult.completed,
      actualRevenue: statsResult.actualRevenue,
      estimatedRevenue: statsResult.estimatedRevenue,
      totalFeedback: statsResult.totalFeedback,
      totalBookings: bookings.length,
      paidBookings: paidBookings.length,
      approvedBookings: approvedBookings.length,
    })

    return statsResult
  }, [rooms, bookings, feedbacks])

  // Get recent bookings
  const recentBookings = useMemo(() => {
    return bookings
      .slice(0, 5)
      .map((booking) => ({
        id: booking.id?.substring(0, 8) || "N/A",
        guest: booking.name || "N/A",
        room: booking.roomType || "N/A",
        date: booking.checkIn
          ? new Date(booking.checkIn).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "N/A",
        status: booking.status?.trim() || "Pending",
        paymentStatus: booking.paymentStatus || "unpaid",
      }))
  }, [bookings])

  const STATS_CONFIG = [
    { label: "Total Rooms", value: stats.totalRooms.toString(), icon: DoorOpen, color: "text-blue-500", key: "rooms" },
    { label: "Bookings Today", value: stats.bookingsToday.toString(), icon: BookOpen, color: "text-green-500", key: "today" },
    { label: "Pending Approval", value: stats.pendingApproval.toString(), icon: Users, color: "text-yellow-500", key: "pending" },
    { label: "Completed", value: stats.completed.toString(), icon: CheckCircle, color: "text-primary", key: "completed" },
    {
      label: "Actual Revenue",
      value: `₱${stats.actualRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-accent",
      key: "actualRevenue",
    },
    {
      label: "Estimated Revenue",
      value: `₱${stats.estimatedRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: "text-purple-500",
      key: "estimatedRevenue",
    },
    { label: "Total Feedback", value: stats.totalFeedback.toString(), icon: MessageSquare, color: "text-orange-500", key: "feedback" },
  ]

  const chartConfig = {
    actualRevenue: {
      label: "Actual Revenue",
      color: "hsl(var(--chart-1))",
    },
    estimatedRevenue: {
      label: "Estimated Revenue",
      color: "hsl(var(--chart-2))",
    },
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-foreground mb-8">Dashboard Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {loading ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-6 shadow-lg border border-border">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-20" />
                </div>
                <Skeleton className="h-10 w-10 rounded" />
              </div>
              <Skeleton className="h-1 w-full rounded-full" />
            </div>
          ))
        ) : (
          STATS_CONFIG.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.key} className="bg-card rounded-xl p-6 shadow-lg border border-border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-muted-foreground text-sm font-medium">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-2">{stat.value}</p>
                  </div>
                  <Icon className={`w-10 h-10 ${stat.color}`} />
                </div>
                <div className="h-1 bg-secondary rounded-full" />
              </div>
            )
          })
        )}
      </div>

      {/* Revenue Chart */}
      <div className="bg-card rounded-xl p-6 shadow-lg mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-4">
          <h2 className="text-xl font-bold text-foreground">Revenue Trend</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setChartView("day")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                chartView === "day"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Day
            </button>
            <button
              onClick={() => setChartView("week")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                chartView === "week"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setChartView("month")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                chartView === "month"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Month
            </button>
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-64 w-full" />
        ) : revenueData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            <p>No revenue data available yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <ChartContainer config={chartConfig} className="h-64 min-w-[600px]">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs"
                  tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actualRevenue"
                  stroke="var(--color-actualRevenue)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="Actual Revenue"
                />
                <Line
                  type="monotone"
                  dataKey="estimatedRevenue"
                  stroke="var(--color-estimatedRevenue)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                  name="Estimated Revenue"
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </div>

      {/* Recent Bookings */}
      <div className="bg-card rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-bold text-foreground mb-4">Recent Bookings</h2>
        
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-foreground">ID</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Guest</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Room</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Check-in</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Payment</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="py-3 px-4">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                  </tr>
                ))
              ) : recentBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No bookings found
                  </td>
                </tr>
              ) : (
                recentBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-border hover:bg-secondary/30">
                    <td className="py-3 px-4">{booking.id}</td>
                    <td className="py-3 px-4">{booking.guest}</td>
                    <td className="py-3 px-4">{booking.room}</td>
                    <td className="py-3 px-4">{booking.date}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          booking.status === "Approved"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : booking.status === "Pending"
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                              : booking.status === "Completed"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                                : booking.status === "Cancelled"
                                  ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          booking.paymentStatus === "paid"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                        }`}
                      >
                        {booking.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-secondary/50 rounded-lg p-4 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            ))
          ) : recentBookings.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              No bookings found
            </div>
          ) : (
            recentBookings.map((booking) => (
              <div key={booking.id} className="bg-secondary/50 rounded-lg p-4 space-y-3 border border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">ID</span>
                  <span className="text-sm font-medium text-foreground">{booking.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Guest</span>
                  <span className="text-sm font-medium text-foreground">{booking.guest}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Room</span>
                  <span className="text-sm font-medium text-foreground">{booking.room}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Check-in</span>
                  <span className="text-sm font-medium text-foreground">{booking.date}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Status</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      booking.status === "Approved"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : booking.status === "Pending"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : booking.status === "Completed"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            : booking.status === "Cancelled"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Payment</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      booking.paymentStatus === "paid"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
                    }`}
                  >
                    {booking.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

