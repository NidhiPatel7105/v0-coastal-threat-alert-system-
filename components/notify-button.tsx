// For real push via Firebase, configure server-side /api/notify/fcm and client registration separately.
"use client"

import { Button } from "@/components/ui/button"

export default function NotifyButton() {
  return (
    <Button
      variant="outline"
      onClick={async () => {
        if (!("Notification" in window)) {
          alert("Notifications not supported in this browser.")
          return
        }
        const perm = await Notification.requestPermission()
        if (perm === "granted") {
          new Notification("Notifications enabled", { body: "You will see in-browser test alerts here." })
        }
      }}
    >
      Enable Notifications
    </Button>
  )
}
