"use client"

import { useState, useEffect } from "react"
import { Download, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export default function PWAInstallButton({ variant = "default", className = "" }: { variant?: "default" | "sidebar" | "footer" | "footer-banner", className?: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    // Check if already installed
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsInstalled(true)
      return
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log("[PWA Install] beforeinstallprompt event fired")
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    
    // Debug: Log installability
    console.log("[PWA Install] Component mounted, checking installability...")
    console.log("[PWA Install] Standalone mode:", window.matchMedia("(display-mode: standalone)").matches)
    console.log("[PWA Install] Service worker support:", "serviceWorker" in navigator)

    // Check if app is already installed
    const checkInstalled = () => {
      if (typeof window === 'undefined') return
      if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
        setIsInstalled(true)
        setShowBanner(false)
      }
    }

    checkInstalled()
    const interval = setInterval(checkInstalled, 1000)

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      }
      clearInterval(interval)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log("[PWA Install] No deferred prompt available. Checking installability...")
      
      // Try to show manual install instructions
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isAndroid = /Android/.test(navigator.userAgent)
      
      if (isIOS) {
        alert("To install this app on iOS:\n1. Tap the Share button\n2. Select 'Add to Home Screen'\n3. Tap 'Add'")
      } else if (isAndroid) {
        alert("To install this app on Android:\n1. Tap the menu (3 dots)\n2. Select 'Install app' or 'Add to Home screen'")
      } else {
        alert("To install this app:\n1. Look for the install icon in your browser's address bar\n2. Or use your browser's menu to find 'Install' option")
      }
      return
    }

    try {
      console.log("[PWA Install] Showing install prompt...")
      
      // Show install prompt
      await deferredPrompt.prompt()

      // Wait for user response
      const { outcome } = await deferredPrompt.userChoice

      console.log("[PWA Install] User choice:", outcome)

      if (outcome === "accepted") {
        console.log("[PWA] ✅ User accepted install prompt")
        setIsInstalled(true)
        setShowBanner(false)
      } else {
        console.log("[PWA] ❌ User dismissed install prompt")
      }
    } catch (error) {
      console.error("[PWA Install] Error showing prompt:", error)
    } finally {
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    setShowBanner(false)
    // Store dismissal in sessionStorage (not localStorage) to not show again for this session only
    if (typeof window !== 'undefined' && window.sessionStorage) {
      sessionStorage.setItem("pwa-install-dismissed", "true")
    }
  }

  // Check if user dismissed in this session
  useEffect(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (sessionStorage.getItem("pwa-install-dismissed") === "true") {
        setShowBanner(false)
      }
    }
  }, [])

  // Don't show if already installed
  if (isInstalled) {
    return null
  }

  if (variant === "sidebar") {
    return (
      <div className={`${className} ${showBanner ? "block" : "hidden"}`}>
        <button
          onClick={handleInstallClick}
          className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold bg-emerald-700 hover:bg-emerald-600 text-white transition-all duration-200"
        >
          <Download size={16} />
          <span>Install App</span>
        </button>
      </div>
    )
  }

  if (variant === "footer") {
    // Footer variant - show as button in footer section
    // Always show the button, but enable it only when prompt is available
    const isDismissed = typeof window !== 'undefined' && window.sessionStorage 
      ? sessionStorage.getItem("pwa-install-dismissed") === "true"
      : false
    
    // Always show button, but make it more prominent when prompt is available
    return (
      <div className="mt-4">
        <button
          onClick={handleInstallClick}
          disabled={isDismissed && !deferredPrompt}
          className={`w-full px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-md ${
            deferredPrompt && !isDismissed
              ? "bg-white text-emerald-700 hover:bg-emerald-50 cursor-pointer"
              : "bg-emerald-600/80 text-white hover:bg-emerald-600 cursor-pointer"
          } ${isDismissed && !deferredPrompt ? "opacity-50 cursor-not-allowed" : ""}`}
          title={
            deferredPrompt 
              ? "Click to install the app" 
              : isDismissed
              ? "Install prompt dismissed. Clear browser data to see it again."
              : "Install prompt will appear when available (requires HTTPS and PWA requirements)"
          }
        >
          <Download size={18} />
          <span>Install App</span>
        </button>
        <p className="text-xs text-emerald-200 mt-2 text-center">
          {deferredPrompt && !isDismissed
            ? "Get quick access and work offline"
            : "Install available when browser prompts (HTTPS required)"}
        </p>
      </div>
    )
  }

  if (variant === "footer-banner") {
    // Footer banner variant (fixed bottom)
    const isDismissed = typeof window !== 'undefined' && window.sessionStorage
      ? sessionStorage.getItem("pwa-install-dismissed") === "true"
      : false
    if (isDismissed || !showBanner || !deferredPrompt) return null
    
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-emerald-700 text-white p-4 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="font-semibold text-sm">Install LuxeStay App</p>
            <p className="text-xs text-emerald-100">Get quick access and work offline</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleInstallClick}
              className="bg-white text-emerald-700 hover:bg-emerald-50"
              size="sm"
            >
              <Download size={16} className="mr-2" />
              Install
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-emerald-600 rounded transition-colors"
              aria-label="Dismiss"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <>
      {showBanner && deferredPrompt && (
        <Button
          onClick={handleInstallClick}
          className={className}
          variant="default"
        >
          <Download size={16} className="mr-2" />
          Install App
        </Button>
      )}
    </>
  )
}

