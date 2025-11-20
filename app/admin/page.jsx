"use client"

import { useEffect, useState } from "react"
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import {
  BedDouble,
  CalendarCheck,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Paintbrush,
  Star,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { auth, db, googleProvider } from "@/lib/firebase"
import { BRANDING_DEFAULTS, useBranding } from "@/hooks/use-branding"
import { Toaster } from "@/components/ui/sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { AddRoomModal } from "@/components/admin/add-room-modal"
import { PreviewRoomModal } from "@/components/admin/preview-room-modal"
import ManageBookings from "@/components/admin/pages/manage-bookings"
import ManageContact from "@/components/admin/pages/manage-contact"
import ManageFeedback from "@/components/admin/pages/manage-feedback"
import AdminOverview from "@/components/admin/pages/admin-overview"

const ALLOWED_ADMINS = ["admin@luxestay.com", "resort.helpdesk01@gmail.com"]

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "manage-rooms", label: "Manage Rooms", icon: BedDouble },
  { key: "manage-bookings", label: "Manage Bookings", icon: CalendarCheck },
  { key: "contact-messages", label: "Contact Messages", icon: MessageCircle },
  { key: "manage-feedback", label: "Manage Feedback", icon: Star },
  { key: "brand-settings", label: "Brand Settings", icon: Paintbrush },
]

export default function AdminPage() {
  const { branding, updateBranding } = useBranding()
  const [currentPage, setCurrentPage] = useState("dashboard")
  const [adminUser, setAdminUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState("")
  const [authSubmitting, setAuthSubmitting] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileSidebarVisible, setMobileSidebarVisible] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [brandForm, setBrandForm] = useState(() => ({
    ...BRANDING_DEFAULTS,
    ...branding,
  }))
  const [brandSaved, setBrandSaved] = useState(false)
  const [brandSaving, setBrandSaving] = useState(false)
  const [addRoomOpen, setAddRoomOpen] = useState(false)
  const [previewRoom, setPreviewRoom] = useState(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const ROOMS_PER_PAGE = 6
  const [rooms, setRooms] = useState([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState("")
  const [roomsPage, setRoomsPage] = useState(1)
  const sidebarBrandName = (branding.name || BRANDING_DEFAULTS.name).trim().split(" ")[0] || BRANDING_DEFAULTS.name

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setAdminUser(null)
        setAuthLoading(false)
        return
      }

      if (ALLOWED_ADMINS.length && !ALLOWED_ADMINS.includes(firebaseUser.email ?? "")) {
        setAuthError("This Google account is not authorized for admin access.")
        signOut(auth)
        setAdminUser(null)
        setAuthLoading(false)
        return
      }

      setAdminUser(firebaseUser)
      setAuthError("")
      setAuthLoading(false)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    setBrandForm((prev) => ({
      ...BRANDING_DEFAULTS,
      ...prev,
      ...branding,
    }))
  }, [branding])

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return
      if (window.innerWidth < 1024) {
        setSidebarExpanded(false)
    } else {
        setSidebarExpanded(true)
        setMobileSidebarVisible(false)
      }
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  useEffect(() => {
    const roomsQuery = query(collection(db, "rooms"), orderBy("createdAt", "desc"))
    const unsubscribe = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const mapped = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setRooms(mapped)
        setRoomsPage((prev) => {
          const totalPages = Math.max(1, Math.ceil(mapped.length / ROOMS_PER_PAGE))
          return Math.min(prev, totalPages)
        })
        setRoomsLoading(false)
      },
      (error) => {
        console.error("Failed to load rooms", error)
        setRoomsError("Failed to load rooms.")
        setRoomsLoading(false)
      },
    )
    return () => unsubscribe()
  }, [])

  const handleBrandFieldChange = (field) => (event) => {
    const { value } = event.target
    setBrandForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleBrandingSubmit = async (event) => {
    event.preventDefault()
    setBrandSaving(true)
    try {
      await updateBranding(brandForm)
      setBrandSaved(true)
      toast.success("Branding saved successfully to Firebase.")
      setTimeout(() => setBrandSaved(false), 2500)
    } catch (error) {
      console.error("Failed to save branding", error)
      toast.error("Failed to save branding. Please try again.")
    } finally {
      setBrandSaving(false)
    }
  }

  const handleBrandReset = async () => {
    setBrandForm(BRANDING_DEFAULTS)
    try {
      await updateBranding(BRANDING_DEFAULTS)
      toast.success("Branding reset to defaults.")
    } catch (error) {
      console.error("Failed to reset branding", error)
      toast.error("Failed to reset branding. Please try again.")
    }
  }

  const handleGoogleLogin = async () => {
    setAuthSubmitting(true)
    setAuthError("")
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error("Google login failed", error)
      setAuthError("Google login failed. Please try again.")
    } finally {
      setAuthSubmitting(false)
    }
  }

  const handleLogout = async () => {
    setLogoutDialogOpen(true)
  }

  const confirmLogout = async () => {
    setLogoutDialogOpen(false)
    await signOut(auth)
    setAdminUser(null)
    setCurrentPage("dashboard")
    toast.success("Logged out successfully")
  }

  const handleRoomSave = async (payload) => {
    try {
      await addDoc(collection(db, "rooms"), {
        name: payload.name,
        roomNumber: payload.number,
        type: payload.type,
        description: payload.description,
        price: Number(payload.price) || 0,
        discount: Number(payload.discount) || 0,
        maxGuests: Number(payload.maxGuests) || 1,
        bedType: payload.bedType,
        beds: Number(payload.beds) || 1,
        amenities: payload.amenities,
        availability: payload.availability,
        featured: Boolean(payload.featured),
        images: payload.images,
        createdAt: serverTimestamp(),
      })

      toast.success("Room saved successfully.")
      setAddRoomOpen(false)
    } catch (error) {
      console.error("Failed to save room", error)
      toast.error("Failed to save room. Please try again.")
      throw error
    }
  }

  const handleRoomUpdate = async (payload) => {
    const roomId = payload.id || previewRoom?.id
    if (!roomId) return
    try {
      await updateDoc(doc(db, "rooms", roomId), {
        name: payload.name,
        roomNumber: payload.number,
        type: payload.type,
        description: payload.description,
        price: Number(payload.price) || 0,
        discount: Number(payload.discount) || 0,
        maxGuests: Number(payload.maxGuests) || 1,
        bedType: payload.bedType,
        beds: Number(payload.beds) || 1,
        amenities: payload.amenities,
        availability: payload.availability,
        featured: Boolean(payload.featured),
        images: payload.images,
        updatedAt: serverTimestamp(),
      })
      toast.success("Room updated successfully.")
      setPreviewOpen(false)
      setPreviewRoom(null)
    } catch (error) {
      console.error("Failed to update room", error)
      toast.error("Failed to update room. Please try again.")
      throw error
    }
  }

  const handleRoomDelete = async (roomId) => {
    if (!roomId) return
    setDeletingId(roomId)
    try {
      await deleteDoc(doc(db, "rooms", roomId))
      toast.success("Room deleted successfully.")
      setPendingDeleteId(null)
    } catch (error) {
      console.error("Failed to delete room", error)
      toast.error("Failed to delete room. Please try again.")
    } finally {
      setDeletingId(null)
    }
  }

  const totalRoomPages = Math.max(1, Math.ceil(rooms.length / ROOMS_PER_PAGE))
  const paginatedRooms = rooms.slice((roomsPage - 1) * ROOMS_PER_PAGE, roomsPage * ROOMS_PER_PAGE)

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-white">
        <p className="text-gray-500 tracking-[0.2em] uppercase">Preparing portal…</p>
      </div>
    )
  }

  if (!adminUser) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-white shadow-sm">
              <img
                src={branding.logo || "/placeholder-logo.png"}
                alt={`${branding.name} logo`}
                className="h-12 w-12 object-contain"
              />
            </div>
            <h1 className="text-4xl font-bold text-emerald-700 mb-1 tracking-[0.2em] uppercase">{branding.name}</h1>
            <p className="text-gray-600">{branding.tagline || "Admin Portal"}</p>
          </div>

          <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Sign in with Google</h2>

            {authError && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-lg text-sm">{authError}</div>}

              <button
              onClick={handleGoogleLogin}
              disabled={authSubmitting}
              className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-70 disabled:cursor-not-allowed text-white py-3 rounded-lg font-semibold transition flex items-center justify-center gap-3"
              >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 488 512"
                className="h-5 w-5"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C244.5 52.6 74.4 116.6 74.4 256c0 86.5 69.1 156.6 153.6 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4"
                />
              </svg>
              {authSubmitting ? "Connecting…" : "Continue with Google"}
              </button>

            <p className="mt-4 text-xs text-gray-500 text-center">
              Only whitelisted Google accounts can access the {branding.name} admin dashboard.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Toaster position="top-center" richColors />
        <div
        className={`fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileSidebarVisible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
          onClick={() => setMobileSidebarVisible(false)}
        />
    <div className="flex h-screen bg-gradient-to-b from-slate-50 to-white">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col bg-emerald-900 text-white shadow-2xl transition-all duration-300 ease-in-out lg:static lg:shadow-none ${
            mobileSidebarVisible 
              ? "translate-x-0 w-64" 
              : "-translate-x-full w-64 lg:translate-x-0"
          } ${
            sidebarExpanded ? "lg:w-64" : "lg:w-20"
          }`}
        >
          <div className={`relative flex items-center gap-3 border-b border-emerald-800 transition-all duration-300 ${
            sidebarExpanded ? "px-5" : "px-3 lg:px-3"
          } py-6`}>
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-emerald-600 bg-white/10">
              <img
                src={branding.logo || "/placeholder-logo.png"}
                alt={`${branding.name} logo`}
                className="h-9 w-9 rounded-full object-cover"
              />
        </div>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                (mobileSidebarVisible || sidebarExpanded)
                  ? "max-w-full opacity-100" 
                  : "max-w-0 opacity-0 lg:max-w-0 lg:opacity-0"
              }`}
            >
              <p className="text-lg font-bold tracking-[0.2em] uppercase whitespace-nowrap">{sidebarBrandName}</p>
              <p className="text-[11px] text-emerald-200 whitespace-nowrap">{branding.tagline || "Admin Portal"}</p>
              <p className="text-[10px] text-emerald-200/70 mt-1 truncate">{adminUser?.email}</p>
            </div>
            <button
              onClick={() => setMobileSidebarVisible(false)}
              className="absolute right-4 top-6 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white transition-all duration-200 hover:bg-white/10 lg:hidden"
            >
              <X size={18} />
            </button>
            <button
              onClick={() => setSidebarExpanded((prev) => !prev)}
              className="absolute -right-4 top-8 hidden h-9 w-9 items-center justify-center rounded-full border border-emerald-700 bg-emerald-900 text-white shadow-xl transition-all duration-200 hover:bg-emerald-800 lg:inline-flex"
            >
              {sidebarExpanded ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
            </button>
          </div>

          <nav className={`flex-1 space-y-2 px-3 py-5 transition-all duration-300 ${
            sidebarExpanded 
              ? "overflow-y-auto" 
              : "overflow-hidden lg:overflow-hidden"
          }`}>
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
              const isActive = currentPage === key
              return (
                <button
                  key={key}
                  onClick={() => {
                    setCurrentPage(key)
                    setMobileSidebarVisible(false)
                  }}
                  className={`group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold tracking-wide transition-all duration-200 ${
                    isActive
                      ? "bg-white/15 text-white shadow-inner shadow-emerald-900/40"
                      : "text-emerald-100 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span
                    className={`truncate transition-all duration-300 ${
                      (mobileSidebarVisible || sidebarExpanded)
                        ? "max-w-full opacity-100" 
                        : "max-w-0 opacity-0 lg:max-w-0 lg:opacity-0"
                    }`}
                  >
                    {label}
                  </span>
                  {!sidebarExpanded && (
                    <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md bg-emerald-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:opacity-100 z-50">
                      {label}
                    </span>
                  )}
                </button>
              )
            })}
        </nav>

          <div className={`border-t border-emerald-800 transition-all duration-300 ${
            sidebarExpanded ? "px-5" : "px-3 lg:px-3"
          } py-5`}>
            <div
              className={`text-sm overflow-hidden transition-all duration-300 ${
                (mobileSidebarVisible || sidebarExpanded)
                  ? "max-w-full opacity-100" 
                  : "max-w-0 opacity-0 lg:max-w-0 lg:opacity-0"
              }`}
            >
              <p className="text-xs uppercase tracking-[0.25em] text-emerald-200 whitespace-nowrap">Signed in as</p>
              <p className="font-semibold whitespace-nowrap">{adminUser?.displayName ?? "Administrator"}</p>
            </div>
          <button
              onClick={handleLogout}
              className="relative w-full rounded-lg bg-red-600 py-2 font-semibold text-white transition-all duration-200 hover:bg-red-700 flex items-center justify-center"
          >
              <span className={`transition-all duration-300 ${
                (mobileSidebarVisible || sidebarExpanded)
                  ? "opacity-100 max-w-full" 
                  : "opacity-0 max-w-0 overflow-hidden lg:opacity-0 lg:max-w-0"
              }`}>
            Logout
              </span>
              {!(mobileSidebarVisible || sidebarExpanded) && (
                <span className="absolute inset-0 flex items-center justify-center opacity-0 lg:opacity-100 transition-opacity duration-300">
                  <LogOut size={18} />
                </span>
              )}
          </button>
          </div>
        </aside>

        <main className={`flex-1 overflow-auto transition-all duration-300 ${
          sidebarExpanded ? "lg:ml-0" : "lg:ml-0"
        }`}>
          <div className="p-6 lg:p-8">
            <div className="mb-6 flex items-center justify-between gap-3 lg:hidden">
              <button
                onClick={() => setMobileSidebarVisible((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm"
              >
                <Menu size={18} />
                Menu
              </button>
              <div className="flex items-center gap-3 rounded-full border border-emerald-100 bg-white/70 px-4 py-2 shadow-sm">
                <img
                  src={branding.logo || "/placeholder-logo.png"}
                  alt={`${branding.name} logo`}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div className="text-left">
                  <p className="text-sm font-semibold text-emerald-900">{branding.name}</p>
                  <p className="text-xs text-gray-500">{branding.tagline || "Admin Portal"}</p>
                </div>
        </div>
      </div>
          {currentPage === "dashboard" && <AdminOverview />}

          {currentPage === "manage-rooms" && (
            <div>
              <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-800">Manage Rooms</h1>
                  <p className="text-sm text-gray-500">Add new rooms or update existing inventory.</p>
                </div>
                <button
                  onClick={() => setAddRoomOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-700/30 transition hover:-translate-y-0.5 hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <span className="text-lg leading-none">+</span>
                  Add Room
                      </button>
                    </div>

              {roomsLoading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {[0, 1, 2].map((idx) => (
                    <div key={idx} className="rounded-2xl border border-emerald-50 bg-white p-6 shadow animate-pulse">
                      <div className="mb-4 h-4 w-1/3 rounded bg-slate-200" />
                      <div className="mb-6 h-3 w-2/3 rounded bg-slate-100" />
                      <div className="h-10 rounded bg-slate-100" />
                  </div>
                ))}
              </div>
              ) : roomsError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{roomsError}</div>
              ) : rooms.length ? (
                <>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    {paginatedRooms.map((room) => (
                    <div
                      key={room.id}
                      className="group flex h-full flex-col rounded-2xl border border-emerald-50 bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-emerald-200"
                    >
                      <div className="relative mb-4">
                        {room.images?.[0] ? (
                          <img
                            src={room.images[0]}
                            alt={`${room.name} preview`}
                            className="h-36 w-full rounded-xl object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-36 w-full items-center justify-center rounded-xl border border-dashed border-emerald-100 bg-emerald-50/50 text-sm text-emerald-700">
                            No preview
            </div>
          )}
                        <button
                          onClick={() => {
                            setPreviewRoom(room)
                            setPreviewOpen(true)
                          }}
                          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/80 text-emerald-800 shadow transition hover:bg-white"
                          title="Preview room"
                        >
                          <Eye size={18} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-lg font-bold text-emerald-700 line-clamp-1">{room.name}</h3>
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              room.availability === "Available"
                                ? "bg-emerald-50 text-emerald-700"
                                : room.availability === "Maintenance"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {room.availability}
                          </span>
                          {pendingDeleteId === room.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleRoomDelete(room.id)}
                                disabled={deletingId === room.id}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:border-red-400 disabled:opacity-60"
                                title="Confirm delete"
                              >
                                {deletingId === room.id ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-600" />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                              <button
                                onClick={() => setPendingDeleteId(null)}
                                className="inline-flex h-9 w-9.items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-gray-400"
                                title="Cancel"
                              >
                                <X size={16} />
                            </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setPendingDeleteId(room.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:border-red-400"
                              title="Delete room"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-gray-500">
                        ₱{(room.price ?? 0).toLocaleString()} / night • {room.maxGuests ?? 1} guests
                    </p>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-500">
                        <span className="rounded-full bg-gray-100 px-3 py-1">Type: {room.type}</span>
                        <span className="rounded-full bg-gray-100 px-3 py-1">Beds: {room.beds}</span>
                        {room.featured && <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700">Featured</span>}
                      </div>
                      {room.amenities?.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2 text-xs text-gray-600">
                          {room.amenities.slice(0, 4).map((amenity, index) => (
                            <span key={`${room.id}-amenity-${index}`} className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">
                              {amenity}
                            </span>
                          ))}
                          {room.amenities.length > 4 && (
                            <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-600">+{room.amenities.length - 4} more</span>
                          )}
                        </div>
                      )}
                          </div>
                    ))}
                  </div>
                  {totalRoomPages > 1 && (
                    <div className="mt-6 flex flex-col items-center gap-3 text-sm text-gray-600 md:flex-row md:justify-between">
                      <button
                        onClick={() => setRoomsPage((prev) => Math.max(1, prev - 1))}
                        disabled={roomsPage === 1}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 font-semibold text-emerald-800 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <p className="font-medium">
                        Page {roomsPage} of {totalRoomPages}
                      </p>
                      <button
                        onClick={() => setRoomsPage((prev) => Math.min(totalRoomPages, prev + 1))}
                        disabled={roomsPage === totalRoomPages}
                        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 font-semibold text-emerald-800 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-emerald-200 bg-white p-8 text-center text-sm text-gray-500">
                  No rooms added yet. Click “Add Room” to create one.
              </div>
              )}
            </div>
          )}

          {currentPage === "manage-bookings" && <ManageBookings />}

          {currentPage === "contact-messages" && <ManageContact />}

          {currentPage === "manage-feedback" && <ManageFeedback />}

          {currentPage === "brand-settings" && (
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-8">Brand Settings</h1>
              <div className="grid gap-8 lg:grid-cols-2">
                <form onSubmit={handleBrandingSubmit} className="space-y-6 rounded-xl bg-card p-6 shadow-lg">
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">Brand Identity</h2>
                  <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Brand Name</label>
                    <input
                      type="text"
                        value={brandForm.name || ""}
                      onChange={handleBrandFieldChange("name")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Hotel name"
                      required
                    />
                  </div>
                  <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Tagline</label>
                    <input
                      type="text"
                        value={brandForm.tagline || ""}
                      onChange={handleBrandFieldChange("tagline")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="Luxury reimagined"
                    />
                  </div>
                  <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Logo URL</label>
                    <input
                      type="url"
                        value={brandForm.logo || ""}
                      onChange={handleBrandFieldChange("logo")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      placeholder="https://your-domain.com/logo.png"
                    />
                      <p className="mt-2 text-xs text-muted-foreground">Tip: Use a transparent PNG or SVG for best results.</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Favicon URL</label>
                      <input
                        type="url"
                        value={brandForm.favicon || ""}
                        onChange={handleBrandFieldChange("favicon")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://your-domain.com/favicon.ico"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">Icon shown in browser tab (16x16 or 32x32 recommended).</p>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Tab Title</label>
                      <input
                        type="text"
                        value={brandForm.tabTitle || ""}
                        onChange={handleBrandFieldChange("tabTitle")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="LuxeStay - Luxury Hotel Booking"
                      />
                      <p className="mt-2 text-xs text-muted-foreground">Title shown in browser tab.</p>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">Contact Information</h2>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Address</label>
                      <input
                        type="text"
                        value={brandForm.address || ""}
                        onChange={handleBrandFieldChange("address")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="123 Luxury Avenue, City Center"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Phone</label>
                      <input
                        type="tel"
                        value={brandForm.phone || ""}
                        onChange={handleBrandFieldChange("phone")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Email</label>
                      <input
                        type="email"
                        value={brandForm.email || ""}
                        onChange={handleBrandFieldChange("email")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="info@luxestay.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-border">
                    <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">Social Media Links</h2>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Facebook URL</label>
                      <input
                        type="url"
                        value={brandForm.facebook || ""}
                        onChange={handleBrandFieldChange("facebook")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://facebook.com/yourpage"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">X (Twitter) URL</label>
                      <input
                        type="url"
                        value={brandForm.twitter || ""}
                        onChange={handleBrandFieldChange("twitter")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://x.com/yourhandle"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">LinkedIn URL</label>
                      <input
                        type="url"
                        value={brandForm.linkedin || ""}
                        onChange={handleBrandFieldChange("linkedin")}
                        className="w-full rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        placeholder="https://linkedin.com/company/yourcompany"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row pt-4 border-t border-border">
                    <button
                      type="submit"
                      disabled={brandSaving}
                      className="flex-1 rounded-lg bg-primary py-2 font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {brandSaving ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/60 border-t-primary-foreground" />
                          Saving…
                        </span>
                      ) : (
                        "Save All Changes"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleBrandReset}
                      className="flex-1 rounded-lg border border-border py-2 font-semibold text-foreground transition hover:bg-secondary"
                    >
                      Reset to Default
                    </button>
                  </div>
                  {brandSaved && (
                    <p className="text-sm font-semibold text-primary">Branding saved! Refresh the public site to verify.</p>
                  )}
                </form>
                <div className="rounded-xl border border-border bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
                  <p className="text-xs uppercase tracking-[0.35em] text-primary-foreground/80">Live Preview</p>
                  <div className="mt-6 flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary-foreground/40 bg-primary-foreground/10">
                      <img
                        src={brandForm.logo || "/placeholder-logo.png"}
                        alt="Brand preview"
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-3xl font-light tracking-[0.3em] uppercase">
                        {brandForm.name || BRANDING_DEFAULTS.name}
                      </p>
                      <p className="text-sm text-primary-foreground/80">{brandForm.tagline || BRANDING_DEFAULTS.tagline}</p>
                    </div>
                  </div>
                  <div className="mt-8 rounded-lg bg-primary-foreground/10 p-4">
                    <p className="text-xs uppercase tracking-[0.35em] text-primary-foreground/70">Landing Page</p>
                    <p className="text-lg font-semibold">{brandForm.name || BRANDING_DEFAULTS.name}</p>
                    <p className="text-sm text-primary-foreground/70">
                      Updates instantly sync with the hero section, navigation logo, tab title, favicon, contact info, and social links.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
    
    {/* Logout Confirmation Modal */}
    <AlertDialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
      <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold text-gray-900">
            Confirm Logout
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-600 pt-2">
            Are you sure you want to logout? You will need to sign in again to access the admin panel.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          <AlertDialogCancel className="w-full sm:w-auto order-2 sm:order-1">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmLogout}
            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white order-1 sm:order-2"
          >
            Logout
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    
    <AddRoomModal open={addRoomOpen} onClose={() => setAddRoomOpen(false)} onSave={handleRoomSave} />
    <PreviewRoomModal
      open={previewOpen}
      room={previewRoom}
      onClose={() => {
        setPreviewOpen(false)
        setPreviewRoom(null)
      }}
      onSave={handleRoomUpdate}
    />
  </>
  )
}
