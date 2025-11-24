import { Stack } from "expo-router";
import { usePassiveLocationTracking } from "../hooks/usePassiveLocationTracking";

export default function RootLayout() {
  usePassiveLocationTracking();

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
