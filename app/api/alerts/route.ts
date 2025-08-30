// Set environment variables in Project Settings to enable sending:
// - TWILIO_ACCOUNT_SID
// - TWILIO_AUTH_TOKEN
// - TWILIO_FROM_NUMBER
// - ALERT_SMS_TO (comma-separated)
// - FCM_SERVER_KEY (legacy key)  OR implement OAuth v1 for HTTPv1 API
import { NextResponse } from "next/server"
import { sendSmsAlert, sendFcmPush } from "@/lib/notifications"

const alerts: any[] = []

export async function GET() {
  return NextResponse.json({ ok: true, alerts })
}

export async function POST(req: Request) {
  const body = await req.json()
  const alert = {
    message: body.message ?? "Test alert",
    severity: body.severity ?? "info",
    area: body.area ?? "Unknown",
    ts: new Date().toISOString(),
    meta: body.meta ?? {},
  }
  alerts.push(alert)

  // Fire-and-forget notifications
  const notifyResults: string[] = []
  try {
    const smsRes = await sendSmsAlert(alert)
    if (smsRes.sent) notifyResults.push("sms")
  } catch (e) {
    // swallow for demo
  }
  try {
    const fcmRes = await sendFcmPush(alert)
    if (fcmRes.sent) notifyResults.push("push")
  } catch (e) {}

  return NextResponse.json({ ok: true, alert, notified: notifyResults })
}
