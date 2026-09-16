import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { listUsers } from "./auth.ts";
import type { LeadPublic } from "./types.ts";

const expo = new Expo();

export async function notifyNewLead(lead: LeadPublic): Promise<void> {
  const users = listUsers().filter((user) => user.expo_push_token);
  if (!users.length) {
    console.log("Push skipped: no registered Expo tokens yet (open the iOS/Android app to register).");
    return;
  }

  const messages: ExpoPushMessage[] = [];
  for (const user of users) {
    const token = user.expo_push_token!;
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`Skipping invalid Expo token for ${user.email}`);
      continue;
    }
    messages.push({
      to: token,
      sound: "default",
      title: "New Angi lead",
      body: `${lead.customerName}${lead.service ? ` · ${lead.service}` : ""}`,
      data: { leadId: lead.id, type: "lead.created" },
      channelId: "leads",
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      console.log("Expo push tickets", tickets);
    } catch (err) {
      console.error("Expo push failed", err);
    }
  }
}

export async function notifyClaimed(lead: LeadPublic, winnerName: string): Promise<void> {
  const users = listUsers().filter(
    (user) => user.expo_push_token && user.id !== lead.claimedBy
  );
  const messages: ExpoPushMessage[] = [];
  for (const user of users) {
    const token = user.expo_push_token!;
    if (!Expo.isExpoPushToken(token)) continue;
    messages.push({
      to: token,
      sound: "default",
      title: "Lead claimed",
      body: `${winnerName} claimed ${lead.customerName}`,
      data: { leadId: lead.id, type: "lead.claimed" },
      channelId: "leads",
    });
  }
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("Expo push failed", err);
    }
  }
}
