# PayMongo Webhook Setup Guide

## Step 1: Get Webhook Secret from PayMongo

1. Login sa PayMongo Dashboard: https://dashboard.paymongo.com/
2. Pumunta sa **Settings** → **Webhooks**
3. Click **Create Webhook** o **Add Webhook**
4. Copy ang **Webhook Secret** na ibibigay ni PayMongo (ito ay makikita pagkatapos mo i-create ang webhook)

## Step 2: Configure Webhook in PayMongo Dashboard

1. **Webhook URL**: 
   ```
   https://resort-booking-livid.vercel.app/api/payment/paymongo-webhook
   ```

2. **Events to Listen**:
   - ✅ `payment.paid` - Para sa successful payments

3. Click **Create Webhook** o **Save**

4. **Copy the Webhook Secret** - Ito ay kailangan mo para sa environment variable

## Step 3: Add Environment Variable in Vercel

1. Pumunta sa Vercel Dashboard: https://vercel.com/dashboard
2. Select ang project: **resort-booking**
3. Pumunta sa **Settings** → **Environment Variables**
4. Add new variable:
   - **Name**: `PAYMONGO_WEBHOOK_SECRET`
   - **Value**: (Paste ang webhook secret mula sa PayMongo)
   - **Environment**: Production, Preview, Development (select all)
5. Click **Save**

## Step 4: Verify Environment Variables

Make sure na mayroon ka ng lahat ng required environment variables:

- ✅ `PAYMONGO_SECRET_KEY` - Para sa API calls
- ✅ `PAYMONGO_WEBHOOK_SECRET` - Para sa webhook verification (NEW)
- ✅ `PAYMONGO_PUBLIC_KEY` - Para sa frontend (optional)
- ✅ `NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY` - Para sa frontend (optional)

## Step 5: Test the Webhook

1. Sa PayMongo Dashboard, pumunta sa **Webhooks** section
2. Click ang webhook na ginawa mo
3. May option na **Send Test Event** o **Test Webhook**
4. Select **payment.paid** event
5. Check ang Vercel logs para makita kung successful ang webhook

## Step 6: Monitor Webhook Logs

1. Sa Vercel Dashboard, pumunta sa **Deployments**
2. Click ang latest deployment
3. Click **Functions** tab
4. Hanapin ang `/api/payment/paymongo-webhook`
5. Makikita mo ang logs doon

## Troubleshooting

### Webhook not receiving events
- Check kung tama ang webhook URL
- Verify na naka-deploy na ang latest code sa Vercel
- Check Vercel logs para sa errors

### Invalid signature error
- Verify na tama ang `PAYMONGO_WEBHOOK_SECRET` sa Vercel
- Make sure na pareho ang secret sa PayMongo at Vercel
- Redeploy ang app pagkatapos mag-add ng environment variable

### Booking not found error
- Check kung naka-save ang `paymentLinkId` sa booking document
- Verify na tama ang booking ID sa payment link remarks

## Webhook Endpoint Details

**URL**: `https://resort-booking-livid.vercel.app/api/payment/paymongo-webhook`
**Method**: `POST`
**Content-Type**: `application/json`

**What it does**:
1. Verifies webhook signature for security
2. Listens for `payment.paid` events
3. Finds the booking by `paymentLinkId`
4. Updates booking status to "paid"
5. Auto-completes booking if check-out date has passed

