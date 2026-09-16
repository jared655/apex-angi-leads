import { Tabs } from "expo-router";
import { View } from "react-native";
import { useClientOnlyValue } from "@/components/useClientOnlyValue";
import { useLeads } from "@/context/LeadsContext";
import { colors } from "@/lib/theme";

function Mark({ active }: { active: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 1,
        backgroundColor: active ? colors.brass : colors.muted,
      }}
    />
  );
}

export default function TabLayout() {
  const { unclaimed, mine } = useLeads();
  const followUps = mine.filter((lead) => lead.needsFollowUp).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line },
        headerStyle: { backgroundColor: colors.paper },
        headerTintColor: colors.navy,
        headerShown: useClientOnlyValue(false, true),
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Unclaimed",
          tabBarBadge: unclaimed.length || undefined,
          tabBarIcon: ({ focused }) => <Mark active={focused} />,
        }}
      />
      <Tabs.Screen
        name="pipeline"
        options={{
          title: "My pipeline",
          tabBarBadge: followUps || undefined,
          tabBarIcon: ({ focused }) => <Mark active={focused} />,
        }}
      />
      <Tabs.Screen
        name="archive"
        options={{
          title: "Sold / Lost",
          tabBarIcon: ({ focused }) => <Mark active={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <Mark active={focused} />,
        }}
      />
    </Tabs>
  );
}
