import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet, useColorScheme } from "react-native";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";

export default function TabLayout() {
  const colorScheme = useColorScheme() || "light";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ffd33d",
        headerTransparent: Platform.OS === "ios",
        headerTitle: "",
        headerStyle: {
          // Transparent on iOS so headerBackground can show through; solid on Android.
          backgroundColor: Platform.OS === "ios" ? "transparent" : "#25292e",
          height: 58,
        },
        headerShadowVisible: false,
        headerTintColor: "#fff",
        headerBlurEffect:
          Platform.OS === "ios" && !isLiquidGlassAvailable()
            ? colorScheme === "dark"
              ? "dark"
              : "light"
            : undefined,
        headerBackground: () =>
          Platform.OS === "ios" ? (
            isLiquidGlassAvailable() ? (
              <GlassView
                // iOS native glass effect
                blurType={
                  colorScheme === "dark"
                    ? "systemUltraThinMaterialDark"
                    : "systemUltraThinMaterialLight"
                }
                style={StyleSheet.absoluteFill}
              />
            ) : (
              // Fallback to BlurView when liquid glass isn't available
              <BlurView
                tint={colorScheme === "dark" ? "dark" : "light"}
                intensity={70}
                style={StyleSheet.absoluteFill}
              />
            )
          ) : null,
        tabBarStyle: {
          backgroundColor: Platform.OS === "ios" ? "transparent" : "#25292e",
          position: "absolute",
          borderTopWidth: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            isLiquidGlassAvailable() ? (
              <GlassView
                // iOS native glass effect
                blurType={
                  colorScheme === "dark"
                    ? "systemUltraThinMaterialDark"
                    : "systemUltraThinMaterialLight"
                }
                style={StyleSheet.absoluteFill}
              />
            ) : (
              // Fallback to BlurView when liquid glass isn't available
              <BlurView
                tint={colorScheme === "dark" ? "dark" : "light"}
                intensity={80}
                style={StyleSheet.absoluteFill}
              />
            )
          ) : undefined,
      }}
    >
      {/* <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home-sharp" : "home-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="timeTable"
        options={{
          title: "Time Table",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "location" : "location-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="maps"
        options={{
          title: "Maps",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "map" : "map-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
      {/* <Tabs.Screen
        name="gps"
        options={{
          title: "Gps",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={
                focused ? "information-circle" : "information-circle-outline"
              }
              color={color}
              size={24}
            />
          ),
        }}
      /> */}
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "train-sharp" : "train-outline"}
              color={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
