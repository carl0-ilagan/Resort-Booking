// In-memory OTP storage (in production, use Redis or database)
// Use global to persist across Next.js serverless function instances
const globalForOTP = globalThis

if (!globalForOTP.otpStore) {
  globalForOTP.otpStore = new Map()
  
  // Clean up expired OTPs periodically
  if (!globalForOTP.otpCleanupInterval) {
    globalForOTP.otpCleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [email, data] of globalForOTP.otpStore.entries()) {
        if (data.expiresAt < now) {
          globalForOTP.otpStore.delete(email)
        }
      }
    }, 60000) // Clean up every minute
  }
}

const otpStore = globalForOTP.otpStore

export { otpStore }

