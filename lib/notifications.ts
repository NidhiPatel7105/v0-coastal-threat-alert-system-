// This avoids extra SDKs and works in Next-lite server routes.
type Alert = { message: string; severity: string; area: string; ts: string; meta?: any }

export async function sendSmsAlert(alert: Alert) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  const toCsv = process.env.ALERT_SMS_TO

  if (!sid || !token || !from || !toCsv) {
    return { sent: false, reason: "missing_twilio_env" }
  }
  const auth = Buffer.from(`${sid}:${token}`).toString("base64")
  const toList = toCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const body = `[${alert.severity.toUpperCase()}] ${alert.area}: ${alert.message} @ ${new Date(alert.ts).toLocaleString()}`

  await Promise.all(
    toList.map(async (to) => {
      const form = new URLSearchParams()
      form.set("To", to)
      form.set("From", from)
      form.set("Body", body)
      await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: form,
      })
    }),
  )

  return { sent: true }
}

export async function sendFcmPush(alert: Alert) {
  const key = process.env.FCM_SERVER_KEY
  const topic = process.env.FCM_TOPIC || "coastal-threat"
  if (!key) return { sent: false, reason: "missing_fcm_key" }

  const payload = {
    to: `/topics/${topic}`,
    notification: {
      title: `[${alert.severity.toUpperCase()}] ${alert.area}`,
      body: alert.message,
    },
    data: { severity: alert.severity, area: alert.area, ts: alert.ts },
  }
  const res = await fetch("https://fcm.googleapis.com/fcm/send", {
    method: "POST",
    headers: {
      Authorization: `key=${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) return { sent: false, reason: `fcm_${res.status}` }
  return { sent: true }
}
