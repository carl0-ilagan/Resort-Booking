"use client"

import { useEffect } from "react"
import { useBranding } from "@/hooks/use-branding"

export default function DynamicHead() {
  const { branding } = useBranding()

  useEffect(() => {
    // Update document title
    if (branding.tabTitle) {
      document.title = branding.tabTitle
    }

    // Update or create favicon link
    let faviconLink = document.querySelector("link[rel='icon']") as HTMLLinkElement
    if (!faviconLink) {
      faviconLink = document.createElement("link")
      faviconLink.rel = "icon"
      document.head.appendChild(faviconLink)
    }
    
    if (branding.favicon) {
      faviconLink.href = branding.favicon
    }

    // Update apple-touch-icon
    let appleIconLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement
    if (!appleIconLink) {
      appleIconLink = document.createElement("link")
      appleIconLink.rel = "apple-touch-icon"
      document.head.appendChild(appleIconLink)
    }
    
    if (branding.favicon || branding.logo) {
      appleIconLink.href = branding.favicon || branding.logo
    }

    // Update manifest link to force refresh
    let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement
    if (manifestLink) {
      manifestLink.href = `/api/manifest?t=${Date.now()}`
    }

    // Update apple-mobile-web-app-title
    let appleTitleMeta = document.querySelector("meta[name='apple-mobile-web-app-title']") as HTMLMetaElement
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement("meta")
      appleTitleMeta.name = "apple-mobile-web-app-title"
      document.head.appendChild(appleTitleMeta)
    }
    appleTitleMeta.content = branding.name || "LuxeStay"
  }, [branding.tabTitle, branding.favicon, branding.logo, branding.name])

  return null
}

