"use client"

import { useCallback, useEffect, useState } from "react"

export type Branding = {
  name: string
  tagline: string
  logo: string
  favicon: string
  tabTitle: string
  address: string
  phone: string
  email: string
  facebook: string
  twitter: string
  linkedin: string
}

const BRANDING_STORAGE_KEY = "luxestay-branding"

export const BRANDING_DEFAULTS: Branding = {
  name: "LuxeStay",
  tagline: "Luxury Hotel & Resort",
  logo: "/icon.svg",
  favicon: "/icon.svg",
  tabTitle: "LuxeStay - Luxury Hotel Booking",
  address: "123 Luxury Avenue, City Center",
  phone: "+1 (555) 123-4567",
  email: "info@luxestay.com",
  facebook: "",
  twitter: "",
  linkedin: "",
}

const readBranding = (): Branding => {
  if (typeof window === "undefined") return BRANDING_DEFAULTS
  try {
    const stored = window.localStorage.getItem(BRANDING_STORAGE_KEY)
    if (!stored) return BRANDING_DEFAULTS
    const parsed = JSON.parse(stored)
    return {
      ...BRANDING_DEFAULTS,
      ...parsed,
    }
  } catch (error) {
    console.warn("Failed to parse branding from storage", error)
    return BRANDING_DEFAULTS
  }
}

const broadcastBranding = (payload: Branding) => {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("branding:update", {
      detail: payload,
    }),
  )
}

export const persistBranding = (payload: Branding) => {
  if (typeof window === "undefined") return
  window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(payload))
  broadcastBranding(payload)
}

export const useBranding = () => {
  const [branding, setBranding] = useState<Branding>(BRANDING_DEFAULTS)

  useEffect(() => {
    setBranding(readBranding())

    const handleUpdate = (event: Event) => {
      if ("detail" in event) {
        const detail = (event as CustomEvent<Branding>).detail
        setBranding(detail)
      }
    }

    window.addEventListener("branding:update", handleUpdate as EventListener)
    return () => window.removeEventListener("branding:update", handleUpdate as EventListener)
  }, [])

  const updateBranding = useCallback((payload: Branding) => {
    setBranding(payload)
    persistBranding(payload)
  }, [])

  return {
    branding,
    updateBranding,
  }
}

export const resetBranding = () => persistBranding(BRANDING_DEFAULTS)


