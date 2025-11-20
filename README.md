# Resort Booking System

A modern, full-featured resort booking management system built with Next.js, Firebase, and PayMongo integration.

## Features

- 🏨 **Room Management** - Add, edit, and manage resort rooms with pricing
- 📅 **Booking System** - Real-time booking with date availability checking
- 💳 **Payment Integration** - PayMongo payment gateway integration
- 📧 **Email Notifications** - Automated email notifications for bookings
- 👤 **Admin Dashboard** - Comprehensive admin panel for managing bookings, rooms, and settings
- 📱 **PWA Support** - Progressive Web App with offline functionality
- 🔐 **OTP Verification** - Email-based OTP verification for bookings
- 📊 **Analytics Dashboard** - Revenue tracking and booking analytics
- 🎨 **Dynamic Branding** - Customizable branding settings (logo, colors, contact info)
- 💬 **Contact & Feedback** - Contact form and guest feedback system

## Tech Stack

- **Framework**: Next.js 14
- **Database**: Firebase Firestore
- **Authentication**: Firebase Admin
- **Payment**: PayMongo API
- **Email**: Nodemailer (Gmail)
- **UI Components**: Custom components with Tailwind CSS
- **PWA**: Service Worker with offline support

## Getting Started

### Prerequisites

- Node.js 18+ and npm/pnpm
- Firebase project with Firestore enabled
- Gmail account for email service
- PayMongo account (for payment integration)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/carl0-ilagan/Resort-Booking.git
cd Resort-Booking
```

2. Install dependencies:
```bash
npm install
# or
pnpm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:
```env
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key

# Email (Gmail)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
ADMIN_EMAIL=admin@example.com

# PayMongo
PAYMONGO_SECRET_KEY=your_paymongo_secret_key
PAYMONGO_PUBLIC_KEY=your_paymongo_public_key
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=your_paymongo_public_key

# reCAPTCHA
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
```

4. Run the development server:
```bash
npm run dev
# or
pnpm dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/
│   ├── admin/          # Admin dashboard pages
│   ├── api/            # API routes
│   └── page.jsx        # Landing page
├── components/
│   ├── admin/          # Admin components
│   ├── sections/       # Landing page sections
│   └── ui/             # Reusable UI components
├── lib/                # Utilities and Firebase config
├── hooks/              # Custom React hooks
└── public/             # Static assets
```

## Key Features

### Booking Flow
1. User selects dates and room type
2. System checks availability
3. User fills booking form with reCAPTCHA verification
4. OTP sent to user's email
5. User enters 6-digit OTP (auto-submits on completion)
6. Booking saved to Firestore
7. Admin receives email notification

### Admin Dashboard
- **Overview**: Revenue charts, booking statistics
- **Manage Bookings**: Approve, decline, cancel bookings
- **Manage Rooms**: Add, edit, delete rooms
- **Contact Messages**: View and manage contact inquiries
- **Feedback**: Publish/hide guest feedback
- **Brand Settings**: Customize branding and contact info

### Payment Integration
- PayMongo payment links generated for approved bookings
- Webhook integration for payment status updates
- Automatic booking status updates on payment completion

### PWA Features
- Offline support with service worker
- Background sync for form submissions
- Installable on mobile and desktop
- Offline data caching

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- DigitalOcean App Platform

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For support, email admin@example.com or open an issue in the repository.

