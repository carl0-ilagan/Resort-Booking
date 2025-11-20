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
  }, [branding.tabTitle, branding.favicon])

  return null
}

