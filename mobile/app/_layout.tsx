import { Stack, ThemeProvider, DefaultTheme, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useFonts } from "expo-font";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LeadsProvider } from "@/context/LeadsContext";
import { colors } from "@/lib/theme";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const paperTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.paper,
    card: colors.paper,
    text: colors.ink,
    border: colors.line,
    primary: colors.navy,
  },
};

function Gate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (!user && !onLogin) router.replace("/login");
    if (user && onLogin) router.replace("/(tabs)");
  }, [user, loading, segments, router]);

  if (loading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.brass} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider value={paperTheme}>
      <AuthProvider>
        <LeadsProvider>
          <Gate>
            <Stack
              screenOptions={{
                headerTintColor: colors.navy,
                headerStyle: { backgroundColor: colors.paper },
                contentStyle: { backgroundColor: colors.paper },
              }}
            >
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="lead/[id]" options={{ title: "Lead" }} />
            </Stack>
          </Gate>
        </LeadsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.navy },
});
