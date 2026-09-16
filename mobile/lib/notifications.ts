import { Platform } from "react-native";
import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";
import { api } from "./api";

/**
 * Expo Go (store client) — not a development or production binary.
 * Remote Android push was removed from Expo Go in SDK 53; calling those APIs throws.
 */
export function isExpoGoClient(): boolean {
  try {
    if (isRunningInExpoGo()) return true;
  } catch {
    // Fall through to Constants — never throw from detection.
  }
  try {
    const ownership = Constants.appOwnership;
    const environment = Constants.executionEnvironment;
    return ownership === "expo" || environment === "storeClient";
  } catch {
    return false;
  }
}

/** Remote Expo Push is only registered in a dev client or store build. */
export function canRegisterRemotePush(): boolean {
  if (Platform.OS === "web") return false;
  if (isExpoGoClient()) return false;
  return true;
}

/**
 * Register this device for Expo Push. Safe to call from Expo Go:
 * logs and returns `"unavailable"` — never throws.
 *
 * Must not import `expo-notifications` in Expo Go on Android. That module's
 * DevicePushTokenAutoRegistration side effect calls `addPushTokenListener`,
 * which runs `warnOfExpoGoPushUsage` and throws an uncaught Error on SDK 53+.
 */
export async function registerPushToken(): Promise<"native" | "web" | "unavailable"> {
  try {
    if (Platform.OS === "web") return "web";
    if (!canRegisterRemotePush()) {
      console.log(
        "[apex] Remote push skipped in Expo Go (SDK 53+). Inbox still updates in-app. Use a development or production build for Expo Push."
      );
      return "unavailable";
    }
    return await registerRemotePushInStandaloneBuild();
  } catch (err) {
    console.warn("[apex] Push registration skipped", err);
    return "unavailable";
  }
}

async function registerRemotePushInStandaloneBuild(): Promise<"native" | "unavailable"> {
  const Device = await import("expo-device");
  if (!Device.isDevice) return "unavailable";

  const Notifications = await import("expo-notifications");

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

  const projectId =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
  await api("/auth/push-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
  return "native";
}
