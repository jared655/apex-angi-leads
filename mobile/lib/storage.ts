import { Platform } from "react-native";

const TOKEN_KEY = "apex.token";
const USER_KEY = "apex.user";

function webStore(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") return webStore()?.getItem(key) ?? null;
  const SecureStore = await import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore()?.setItem(key, value);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    webStore()?.removeItem(key);
    return;
  }
  const SecureStore = await import("expo-secure-store");
  await SecureStore.deleteItemAsync(key);
}

export async function getToken(): Promise<string | null> {
  return getItem(TOKEN_KEY);
}

export async function setSession(token: string, userJson: string): Promise<void> {
  await setItem(TOKEN_KEY, token);
  await setItem(USER_KEY, userJson);
}

export async function getStoredUser(): Promise<string | null> {
  return getItem(USER_KEY);
}

export async function clearSession(): Promise<void> {
  await removeItem(TOKEN_KEY);
  await removeItem(USER_KEY);
}
