"use client"

import { useState } from "react"
import { Plus, Edit2, Trash2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

interface Room {
  id: number
  title: string
  description: string
  price: number
  capacity: number
  type: string
  status: "Active" | "Hidden"
}

const INITIAL_ROOMS: Room[] = [
  {
    id: 1,
    title: "Deluxe Room",
    description: "Spacious room with city view",
    price: 199,
    capacity: 2,
    type: "Deluxe",
    status: "Active",
  },
  {
    id: 2,
    title: "Suite Room",
    description: "Elegant suite with living area",
    price: 349,
    capacity: 4,
    type: "Suite",
    status: "Active",
  },
  {
    id: 3,
    title: "Presidential Suite",
    description: "Ultimate luxury experience",
    price: 599,
    capacity: 6,
    type: "Presidential",
    status: "Active",
  },
]

export default function ManageRooms() {
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS)
  const [showModal, setShowModal] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [loading] = useState(false) // Set to true when fetching from Firestore

  const handleDelete = (id: number) => {
    setRooms(rooms.filter((r) => r.id !== id))
  }

  const handleEdit = (room: Room) => {
    setEditingRoom(room)
    setShowModal(true)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-foreground">Manage Rooms</h1>
        <Button
          onClick={() => {
            setEditingRoom(null)
            setShowModal(true)
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2"
        >
          <Plus size={20} />
          Add Room
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-6 shadow-lg border border-border">
              <div className="space-y-4">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-20 w-full" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 flex-1" />
                </div>
              </div>
            </div>
          ))
        ) : (
          rooms.map((room) => (
          <div key={room.id} className="bg-card rounded-xl p-6 shadow-lg border border-border">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">{room.title}</h3>
                <p className="text-sm text-muted-foreground">{room.type}</p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${
                  room.status === "Active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                }`}
              >
                <CheckCircle size={14} />
                {room.status}
              </span>
            </div>

            <p className="text-muted-foreground text-sm mb-4">{room.description}</p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-xs text-muted-foreground">Price/Night</p>
                <p className="font-bold text-primary">${room.price}</p>
              </div>
              <div className="p-2 bg-secondary/30 rounded">
                <p className="text-xs text-muted-foreground">Capacity</p>
                <p className="font-bold text-foreground">{room.capacity} guests</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleEdit(room)}
                className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground flex items-center justify-center gap-2"
              >
                <Edit2 size={16} />
                Edit
              </Button>
              <Button
                onClick={() => handleDelete(room.id)}
                className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </Button>
            </div>
          </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">{editingRoom ? "Edit Room" : "Add New Room"}</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Room Title"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
              <textarea
                placeholder="Description"
                rows={3}
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground resize-none"
              />
              <input
                type="number"
                placeholder="Price per night"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
              <input
                type="number"
                placeholder="Capacity"
                className="w-full px-4 py-2 border border-border rounded-lg bg-background text-foreground"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-secondary hover:bg-secondary/80 text-secondary-foreground"
                >
                  Cancel
                </Button>
                <Button className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                  {editingRoom ? "Update" : "Add"} Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
