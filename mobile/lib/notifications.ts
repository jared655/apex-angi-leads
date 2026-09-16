import { Platform } from "react-native";
import { api } from "./api";

export async function registerPushToken(): Promise<"native" | "web" | "unavailable"> {
  if (Platform.OS === "web") return "web";

  try {
    const Device = await import("expo-device");
    const Notifications = await import("expo-notifications");
    if (!Device.isDevice) return "unavailable";

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== "granted") return "unavailable";

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("leads", {
        name: "New Angi leads",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#C6A15B",
      });
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await api("/auth/push-token", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
    return "native";
  } catch (err) {
    console.warn("Push registration skipped", err);
    return "unavailable";
  }
}
