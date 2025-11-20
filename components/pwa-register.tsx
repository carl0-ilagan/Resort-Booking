"use client"

import { useEffect } from "react"
import { syncManager } from "@/lib/offline-storage"

export default function PWARegister() {
  useEffect(() => {
    // Make syncManager available globally for service worker
    if (typeof window !== "undefined") {
      window.syncManager = syncManager
    }

    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service Worker registered:", registration.scope)

          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("[PWA] New service worker available")
                  // Optionally show update notification
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error)
        })

      // Handle service worker messages
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SYNC_OFFLINE_DATA") {
          // Trigger sync from client
          syncManager.sync()
        }
      })
    }

    // Request notification permission for PWA install prompt
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        // User denied or error
      })
    }
  }, [])

  return null
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    syncManager?: any
  }
}

