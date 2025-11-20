"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, Upload, X } from "lucide-react"

const ROOM_TYPES = ["Standard", "Deluxe", "Family", "Executive", "Suite"]
const BED_TYPES = ["Single", "Double", "Queen", "King", "Bunk"]
const AMENITY_PRESETS = [
  "Wifi",
  "Aircon",
  "Television",
  "Hot & Cold Shower",
  "Refrigerator",
  "Balcony",
  "Ocean View",
  "Garden View",
  "Complimentary Breakfast",
  "Room Service",
]
const STATUS_OPTIONS = ["Available", "Maintenance", "Unavailable"]

const createDefaultForm = () => ({
  name: "",
  number: "",
  type: ROOM_TYPES[0],
  description: "",
  price: "",
  discount: "",
  maxGuests: 1,
  bedType: BED_TYPES[0],
  beds: 1,
  images: [],
  amenities: new Set(["Wifi", "Aircon", "Television"]),
  availability: STATUS_OPTIONS[0],
  featured: false,
})

export function AddRoomModal({ open, onClose, onSave }) {
  const [form, setForm] = useState(() => createDefaultForm())
  const [customAmenity, setCustomAmenity] = useState("")
  const [saving, setSaving] = useState(false)
  const amenityList = useMemo(() => Array.from(form.amenities), [form.amenities])

  useEffect(() => {
    if (!open) {
      setForm(createDefaultForm())
      setCustomAmenity("")
      setSaving(false)
      return
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [open])

  if (!open) {
    return null
  }

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleAmenityToggle = (amenity) => {
    setForm((prev) => {
      const nextSet = new Set(prev.amenities)
      if (nextSet.has(amenity)) {
        nextSet.delete(amenity)
      } else {
        nextSet.add(amenity)
      }
      return { ...prev, amenities: nextSet }
    })
  }

  const handleCustomAmenityAdd = () => {
    const trimmed = customAmenity.trim()
    if (!trimmed) return
    handleAmenityToggle(trimmed)
    setCustomAmenity("")
  }

  const readFileAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleImageUpload = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return
    try {
      const encoded = await Promise.all(
        files.map(async (file) => ({
          id: `${file.name}-${crypto.randomUUID()}`,
          url: await readFileAsDataURL(file),
        })),
      )
      setForm((prev) => ({ ...prev, images: [...prev.images, ...encoded].slice(0, 6) }))
    } catch (error) {
      console.error("Failed to encode images", error)
    }
  }

  const handleImageRemove = (id) => {
    setForm((prev) => ({ ...prev, images: prev.images.filter((img) => img.id !== id) }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      amenities: amenityList,
      images: form.images.map((img) => img.url),
    }
    try {
      await onSave?.(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-8 lg:items-start"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.()
        }
      }}
    >
      <div className="relative h-[92vh] w-full max-w-4xl rounded-t-3xl bg-white shadow-2xl ring-1 ring-emerald-100 animate-bottom-sheet lg:ml-auto lg:h-full lg:rounded-3xl lg:animate-side-sheet">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:bg-gray-50"
          aria-label="Close add room modal"
          type="button"
        >
          <X size={18} />
        </button>
        <form className="flex h-full flex-col divide-y divide-gray-100 lg:flex-row lg:divide-x lg:divide-y-0" onSubmit={handleSubmit}>
          <div className="flex-1 overflow-y-auto px-6 pb-8 pt-16 lg:px-8 lg:pt-12">
            <header className="mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Add New Room</p>
              <h2 className="mt-2 text-3xl font-bold text-gray-900">Room Details</h2>
              <p className="text-sm text-gray-500">Fill out the basics, pricing, media, and amenities.</p>
            </header>

            <section className="space-y-4 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">1. Room Basic Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Room Name / Title *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={handleFieldChange("name")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Deluxe Suite, Ocean View Family Room"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Room Number *</label>
                  <input
                    type="text"
                    required
                    value={form.number}
                    onChange={handleFieldChange("number")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="101, A203"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Room Type *</label>
                  <select
                    value={form.type}
                    onChange={handleFieldChange("type")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    {ROOM_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-800">Description *</label>
                <textarea
                  required
                  value={form.description}
                  onChange={handleFieldChange("description")}
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Highlight space, view, services, and what makes it special."
                />
              </div>
            </section>

            <section className="mt-6 space-y-4 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">2. Room Pricing</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-800">Price per Night *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={form.price}
                    onChange={handleFieldChange("price")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="5500"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-800">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={form.discount}
                    onChange={handleFieldChange("discount")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-semibold text-gray-800">Max Guests *</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={form.maxGuests}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 1
                      setForm((prev) => ({ ...prev, maxGuests: Math.min(10, Math.max(1, value)) }))
                    }}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 space-y-4 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">3. Bed & Capacity</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2.block text-sm font-semibold text-gray-800">Bed Type *</label>
                  <select
                    value={form.bedType}
                    onChange={handleFieldChange("bedType")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    {BED_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Number of Beds *</label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={form.beds}
                    onChange={(event) => {
                      const value = Number(event.target.value) || 1
                      setForm((prev) => ({ ...prev, beds: Math.min(6, Math.max(1, value)) }))
                    }}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              </div>
            </section>

            <section className="mt-6 space-y-4 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">4. Room Media</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                {form.images.map((image) => (
                  <div key={image.id} className="group relative">
                    <img src={image.url} alt="Room preview" className="h-32 w-full rounded-2xl object-cover" />
                    <button
                      type="button"
                      onClick={() => handleImageRemove(image.id)}
                      className="absolute inset-0 flex items-center justify-center rounded-2xl bg-slate-900/70 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                {form.images.length < 6 && (
                  <label className="flex h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 text-center text-xs font-semibold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50">
                    <Upload size={18} />
                    Upload
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">Upload up to six highlight images (PNG/JPG).</p>
            </section>

            <section className="mt-6 space-y-4 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">5. Amenities</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {AMENITY_PRESETS.map((amenity) => (
                  <label
                    key={amenity}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                      form.amenities.has(amenity)
                        ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                        : "border-gray-200 text-gray-700 hover:border-emerald-200"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.amenities.has(amenity)}
                      onChange={() => handleAmenityToggle(amenity)}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    {amenity}
                  </label>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={customAmenity}
                  onChange={(event) => setCustomAmenity(event.target.value)}
                  placeholder="Add custom amenity"
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
                <button
                  type="button"
                  onClick={handleCustomAmenityAdd}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:border-emerald-400 hover:text-emerald-900"
                >
                  <Plus size={16} /> Add Amenity
                </button>
              </div>
            </section>

            <section className="mt-6 space-y-4 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">6. Room Status</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-800">Availability</label>
                  <select
                    value={form.availability}
                    onChange={handleFieldChange("availability")}
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-gray-200 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Featured Room?</p>
                    <p className="text-xs text-gray-500">Surface this room prominently on the landing page.</p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={form.featured}
                      onChange={(event) => setForm((prev) => ({ ...prev, featured: event.target.checked }))}
                      className="peer sr-only"
                    />
                    <span className="h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-emerald-600" />
                    <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                  </label>
                </div>
              </div>
            </section>
          </div>

          <div className="flex w-full flex-col gap-4 overflow-y-auto px-6 pb-8 pt-6 lg:max-w-sm lg:px-6">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-600">Summary</h3>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-emerald-900">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-600">Preview</p>
                <h4 className="mt-2 text-xl font-bold">{form.name || "Unnamed Room"}</h4>
                <p className="text-sm text-emerald-800">{form.type} • {form.maxGuests || 1} Guests • {form.bedType}</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p>
                    <span className="font-semibold">Price:</span> {form.price ? `₱${form.price}` : "—"} / night
                  </p>
                  <p>
                    <span className="font-semibold">Discount:</span> {form.discount ? `${form.discount}%` : "None"}
                  </p>
                  <p>
                    <span className="font-semibold">Amenities:</span> {amenityList.length ? amenityList.join(", ") : "None"}
                  </p>
                  <p>
                    <span className="font-semibold">Status:</span> {form.availability}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-700/30 transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                    Saving Room…
                  </>
                ) : (
                  "Save Room"
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

