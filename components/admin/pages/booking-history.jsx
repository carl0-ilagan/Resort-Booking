"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Download } from "lucide-react"

interface HistoryBooking {
  id: string
  guest: string
  email: string
  room: string
  dates: string
  status: string
  payment: string
  revenue: number
}

const HISTORY: HistoryBooking[] = [
  {
    id: "H001",
    guest: "Alice Brown",
    email: "alice@email.com",
    room: "Deluxe",
    dates: "2024-01-01 to 2024-01-05",
    status: "Completed",
    payment: "Paid",
    revenue: 796,
  },
  {
    id: "H002",
    guest: "Bob Davis",
    email: "bob@email.com",
    room: "Suite",
    dates: "2024-01-06 to 2024-01-10",
    status: "Completed",
    payment: "Paid",
    revenue: 1396,
  },
  {
    id: "H003",
    guest: "Carol Evans",
    email: "carol@email.com",
    room: "Presidential",
    dates: "2024-01-11 to 2024-01-16",
    status: "Completed",
    payment: "Paid",
    revenue: 3594,
  },
]

export default function BookingHistory() {
  const [filter, setFilter] = useState("all")
  const [loading] = useState(false) // Set to true when fetching data

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Completed":
        return "bg-blue-100 text-blue-800"
      case "Cancelled":
        return "bg-red-100 text-red-800"
      case "Refunded":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Booking History</h1>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground flex items-center gap-2">
          <Download size={18} />
          Export to Excel
        </Button>
      </div>

      <div className="grid grid-cols-5 gap-2 mb-6">
        {["All", "Today", "This Week", "This Month", "Completed"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f.toLowerCase())}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              filter === f.toLowerCase()
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/30 border-b border-border">
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-foreground">ID</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Guest Info</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Room</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Dates</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Status</th>
                <th className="text-left py-4 px-6 font-semibold text-foreground">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-4 px-6"><Skeleton className="h-4 w-16" /></td>
                    <td className="py-4 px-6">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-40" />
                    </td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-36" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-16" /></td>
                  </tr>
                ))
              ) : (
                HISTORY.map((booking) => (
                <tr key={booking.id} className="border-b border-border hover:bg-secondary/10">
                  <td className="py-4 px-6 font-mono text-foreground">{booking.id}</td>
                  <td className="py-4 px-6">
                    <div>
                      <p className="font-medium text-foreground">{booking.guest}</p>
                      <p className="text-xs text-muted-foreground">{booking.email}</p>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-foreground">{booking.room}</td>
                  <td className="py-4 px-6 text-muted-foreground text-xs">{booking.dates}</td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 font-bold text-primary">${booking.revenue}</td>
                </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
