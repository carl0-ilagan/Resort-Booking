import { getApp, getApps, initializeApp } from "firebase/app"
import { getAuth, GoogleAuthProvider } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import type { Analytics } from "firebase/analytics"

const firebaseConfig = {
  apiKey: "AIzaSyCqpUQ_8O7dyVRrruJl0D6kTJ80KvzDiX4",
  authDomain: "hotel-63c74.firebaseapp.com",
  projectId: "hotel-63c74",
  storageBucket: "hotel-63c74.firebasestorage.app",
  messagingSenderId: "1064106553832",
  appId: "1:1064106553832:web:32433bf4d1bdc76988b45d",
  measurementId: "G-5M9GY1P3TP",
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

// Only initialize client-side services in browser
const auth = typeof window !== "undefined" ? getAuth(app) : null
const googleProvider = typeof window !== "undefined" ? new GoogleAuthProvider() : null
const db = getFirestore(app)
const storage = typeof window !== "undefined" ? getStorage(app) : null

let analyticsInstance: Analytics | null = null

export const getAnalyticsClient = async () => {
  if (typeof window === "undefined") return null
  if (analyticsInstance) return analyticsInstance
  const { getAnalytics } = await import("firebase/analytics")
  analyticsInstance = getAnalytics(app)
  return analyticsInstance
}

export { app, auth, googleProvider, db, storage }

