"use client"

import { useCallback, useEffect, useState } from "react"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore"

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

const BRANDING_DOC_ID = "branding"
const BRANDING_COLLECTION = "settings"

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

const broadcastBranding = (payload: Branding) => {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent("branding:update", {
      detail: payload,
    }),
  )
}

// Read branding from Firestore
const readBrandingFromFirestore = async (): Promise<Branding> => {
  try {
    const brandingRef = doc(db, BRANDING_COLLECTION, BRANDING_DOC_ID)
    const brandingSnap = await getDoc(brandingRef)
    
    if (brandingSnap.exists()) {
      const data = brandingSnap.data()
      return {
        ...BRANDING_DEFAULTS,
        ...data,
      }
    }
    return BRANDING_DEFAULTS
  } catch (error) {
    console.error("Failed to read branding from Firestore", error)
    return BRANDING_DEFAULTS
  }
}

// Save branding to Firestore
export const persistBranding = async (payload: Branding): Promise<void> => {
  try {
    const brandingRef = doc(db, BRANDING_COLLECTION, BRANDING_DOC_ID)
    await setDoc(brandingRef, payload, { merge: true })
    console.log("Branding saved to Firestore successfully")
    broadcastBranding(payload)
  } catch (error) {
    console.error("Failed to save branding to Firestore", error)
    throw error
  }
}

export const useBranding = () => {
  const [branding, setBranding] = useState<Branding>(BRANDING_DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Initial load
    readBrandingFromFirestore().then((data) => {
      setBranding(data)
      setLoading(false)
    })

    // Listen for real-time updates from Firestore
    const brandingRef = doc(db, BRANDING_COLLECTION, BRANDING_DOC_ID)
    const unsubscribe = onSnapshot(
      brandingRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Branding
          const updatedBranding = {
            ...BRANDING_DEFAULTS,
            ...data,
          }
          setBranding(updatedBranding)
          broadcastBranding(updatedBranding)
        } else {
          // Document doesn't exist, use defaults
          setBranding(BRANDING_DEFAULTS)
        }
        setLoading(false)
      },
      (error) => {
        console.error("Error listening to branding updates:", error)
        setLoading(false)
      }
    )

    // Also listen for custom events (for immediate UI updates)
    const handleUpdate = (event: Event) => {
      if ("detail" in event) {
        const detail = (event as CustomEvent<Branding>).detail
        setBranding(detail)
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("branding:update", handleUpdate as EventListener)
    }

    return () => {
      unsubscribe()
      if (typeof window !== "undefined") {
        window.removeEventListener("branding:update", handleUpdate as EventListener)
      }
    }
  }, [])

  const updateBranding = useCallback(async (payload: Branding) => {
    setBranding(payload)
    await persistBranding(payload)
  }, [])

  return {
    branding,
    updateBranding,
    loading,
  }
}

export const resetBranding = async () => {
  await persistBranding(BRANDING_DEFAULTS)
}


