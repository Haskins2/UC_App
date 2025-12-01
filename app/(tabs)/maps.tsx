import {
  Text,
  View,
  StyleSheet,
  Image,
  Platform,
  Alert,
  Linking,
} from "react-native";
import MapView, {
  Marker,
  Polyline,
  Polygon,
  Callout,
  Region,
} from "react-native-maps";
import { useState, useEffect, useRef } from "react";
import * as Location from "expo-location";
import {
  getAllStations,
  Station,
} from "@/utils/IrishRailAPI/returnAllStations";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";

// Zoom Levels
const ZOOM_FAR = 0; // Dots only
const ZOOM_MID = 1; // Icons, no text
const ZOOM_NEAR = 2; // Icons + Text

// Train station icon component using custom image
const TrainIcon = ({
  isClosest,
  name,
  zoomLevel,
}: {
  isClosest?: boolean;
  name?: string;
  zoomLevel: number;
}) => {
  let size = 40;
  let showText = false;
  let showBadge = false;

  // Configure appearance based on discrete zoom level
  if (zoomLevel === ZOOM_FAR) {
    size = 15; // Small dot
    showText = false;
    showBadge = false;
  } else if (zoomLevel === ZOOM_MID) {
    size = 30; // Medium icon
    showText = false;
    showBadge = false; // Hide badge at mid zoom (same as text)
  } else {
    // ZOOM_NEAR
    size = 40; // Full size
    showText = true;
    showBadge = isClosest || false;
  }

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <View
        style={[
          styles.markerContainer,
          isClosest && styles.closestMarkerContainer,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Image
          source={require("@/assets/dart_icon.jpeg")}
          style={[styles.trainIconImage, { width: size, height: size }]}
          resizeMode="contain"
        />
      </View>
      {showBadge && (
        <View style={styles.closestBadge}>
          <Text style={styles.closestText}>Closest</Text>
        </View>
      )}
      {/* Station Name Label on Map */}
      {showText && (
        <View style={styles.stationNameContainer}>
          <Text style={styles.stationNameText} numberOfLines={1}>
            {name}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function MapsScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [closestStation, setClosestStation] = useState<Station | null>(null);
  const [railNetwork, setRailNetwork] = useState<any>(null);
  const [initialRegion, setInitialRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);

  // Track zoom level state
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_MID);

  const handleGetDirections = (station: Station) => {
    const lat = station.StationLatitude;
    const lng = station.StationLongitude;

    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
    const appleMapsUrl = `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=w`;

    if (Platform.OS === "ios") {
      Alert.alert("Get Directions", `To ${station.StationDesc}`, [
        {
          text: "Apple Maps",
          onPress: () => Linking.openURL(appleMapsUrl),
        },
        {
          text: "Google Maps",
          onPress: () => Linking.openURL(googleMapsUrl),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
    } else {
      Alert.alert("Get Directions", `To ${station.StationDesc}`, [
        {
          text: "Google Maps",
          onPress: () => Linking.openURL(googleMapsUrl),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]);
    }
  };

  // Load local GeoJSON as JSON (use relative path instead of '@' alias)
  useEffect(() => {
    try {
      const data = require("../../assets/rail_network.json");
      setRailNetwork(data);
    } catch (e) {
      console.error(
        "Error loading rail network JSON. Ensure assets/rail_network.json exists.",
        e
      );
      setErrorMsg(
        "Could not load rail network data. Ensure assets/rail_network.json exists."
      );
    }
  }, []);

  // Fetch stations once when component mounts
  useEffect(() => {
    const fetchStations = async () => {
      try {
        const stationData = await getAllStations();
        setStations(stationData);
      } catch (error) {
        console.error("Error fetching stations:", error);
      }
    };

    fetchStations();

    // Subscribe to nearest station from Cloud Function
    const unsubscribe = onSnapshot(
      doc(db, "users", "keela_e_duffy", "processed", "nearestStation"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          // Map Firestore data to Station interface
          const nearest: Station = {
            StationDesc: data.stationName,
            StationCode: data.stationCode,
            StationId: String(data.stationId),
            StationLatitude: data.latitude,
            StationLongitude: data.longitude,
          };

          setClosestStation(nearest);
        }
      },
      (err) => {
        console.error("Firestore subscription error:", err);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          setErrorMsg("Permission to access location was denied");
          return;
        }

        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 10, // Or when moved 10 meters
          },
          (newLocation) => {
            setLocation(newLocation);
            // Only set initial region once
            if (!initialRegion) {
              setInitialRegion({
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              });
            }
            setErrorMsg(null);
          }
        );
      } catch (error) {
        setErrorMsg("Error getting location: " + (error as Error).message);
      }
    };

    startLocationTracking();

    // Cleanup function to stop tracking when component unmounts
    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [initialRegion]);

  // Handle region change to update zoom level efficiently
  const onRegionChange = (region: Region) => {
    const delta = region.latitudeDelta;
    let newLevel = ZOOM_MID;

    // Define thresholds for switching views
    // > 0.2: Zoomed out far (Dots)
    // < 0.06: Zoomed in close (Icons + Text)
    if (delta > 0.2) {
      // Increased from 0.15 to 0.2 so icons stay visible longer when zooming out
      newLevel = ZOOM_FAR;
    } else if (delta < 0.06) {
      // Increased from 0.04 to 0.06 so text appears sooner when zooming in
      newLevel = ZOOM_NEAR;
    } else {
      newLevel = ZOOM_MID;
    }

    // Only update state if level changes to prevent re-renders
    if (newLevel !== zoomLevel) {
      setZoomLevel(newLevel);
    }
  };

  // Helper to render one GeoJSON feature
  const renderFeature = (feature: any, idx: number) => {
    const { type, coordinates } = feature?.geometry || {};
    if (!type || !coordinates) return null;

    const toLatLng = (c: number[]) => ({ latitude: c[1], longitude: c[0] });

    switch (type) {
      case "LineString":
        return (
          <Polyline
            key={`ls-${idx}`}
            coordinates={coordinates.map(toLatLng)}
            strokeColor="#1E88E5"
            strokeWidth={3}
          />
        );
      case "MultiLineString":
        return coordinates.map((line: number[][], i: number) => (
          <Polyline
            key={`mls-${idx}-${i}`}
            coordinates={line.map(toLatLng)}
            strokeColor="#1E88E5"
            strokeWidth={3}
          />
        ));
      case "Polygon": {
        const outer = (coordinates[0] || []).map(toLatLng);
        const holes = (coordinates.slice(1) || []).map((ring: number[][]) =>
          ring.map(toLatLng)
        );
        return (
          <Polygon
            key={`pg-${idx}`}
            coordinates={outer}
            holes={holes}
            strokeColor="#1E88E5"
            fillColor="rgba(30,136,229,0.15)"
            strokeWidth={2}
          />
        );
      }
      case "MultiPolygon":
        return coordinates.map((poly: number[][][], i: number) => {
          const outer = (poly[0] || []).map(toLatLng);
          const holes = (poly.slice(1) || []).map((ring: number[][]) =>
            ring.map(toLatLng)
          );
          return (
            <Polygon
              key={`mpg-${idx}-${i}`}
              coordinates={outer}
              holes={holes}
              strokeColor="#1E88E5"
              fillColor="rgba(30,136,229,0.15)"
              strokeWidth={2}
            />
          );
        });
      case "Point": {
        const [lng, lat] = coordinates;
        return (
          <Marker
            key={`pt-${idx}`}
            coordinate={{ latitude: lat, longitude: lng }}
            title={feature?.properties?.name}
          />
        );
      }
      case "MultiPoint":
        return coordinates.map((c: number[], i: number) => (
          <Marker
            key={`mpt-${idx}-${i}`}
            coordinate={{ latitude: c[1], longitude: c[0] }}
          />
        ));
      default:
        return null;
    }
  };

  if (Platform.OS === "web") {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Maps are only available on mobile devices</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {initialRegion ? (
        <MapView
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={true}
          followsUserLocation={false}
          onRegionChange={onRegionChange}
        >
          {railNetwork?.features?.map((f: any, i: number) =>
            renderFeature(f, i)
          )}
          {stations.map((station) => {
            const isClosest =
              closestStation?.StationCode === station.StationCode;
            return (
              <Marker
                key={station.StationId}
                coordinate={{
                  latitude: station.StationLatitude,
                  longitude: station.StationLongitude,
                }}
                zIndex={isClosest ? 999 : 1}
                tracksViewChanges={false} // Optimization: don't re-render marker bitmap constantly
              >
                <TrainIcon
                  isClosest={isClosest}
                  name={station.StationDesc}
                  zoomLevel={zoomLevel}
                />
                <Callout
                  tooltip
                  onPress={() => handleGetDirections(station)}
                  style={styles.calloutWrapper}
                >
                  <View>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutTitle}>
                        {station.StationDesc}
                      </Text>

                      <View style={styles.directionsButton}>
                        <Text style={styles.directionsText}>
                          Get Directions
                        </Text>
                      </View>
                    </View>
                    {/* Arrow to connect callout to marker */}
                    <View style={styles.calloutArrow} />
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.text}>Loading map...</Text>
        </View>
      )}
      {errorMsg && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
  },
  map: {
    flex: 1,
  },
  text: {
    color: "#fff",
  },
  errorContainer: {
    position: "absolute",
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: "rgba(255, 59, 48, 0.9)",
    padding: 15,
    borderRadius: 8,
  },
  errorText: {
    color: "#fff",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "white",
    borderWidth: 2,
    borderColor: "#2196F3",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    justifyContent: "center",
    alignItems: "center",
  },
  closestMarkerContainer: {
    borderColor: "#4CAF50", // Green color
    borderWidth: 3,
    transform: [{ scale: 1.2 }],
  },
  closestBadge: {
    backgroundColor: "#4CAF50",
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "white",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 1,
    elevation: 3,
    position: "absolute", // Position absolute to avoid layout jumps
    bottom: -20,
    width: 50, // Fixed width
    alignItems: "center", // Center text
  },
  closestText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
  },
  trainIconImage: {
    width: 40,
    height: 40,
  },
  // New styles for station name on map
  stationNameContainer: {
    backgroundColor: "rgba(37, 41, 46, 0.85)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  stationNameText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  calloutWrapper: {
    width: 180,
    alignItems: "center",
  },
  calloutContainer: {
    backgroundColor: "#3a3f47", // Dark card background
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    width: "100%",
    borderWidth: 1,
    borderColor: "#4a4f57",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  calloutTitle: {
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 10,
    textAlign: "center",
    color: "#fff", // White text
  },
  calloutArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderStyle: "solid",
    backgroundColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#3a3f47", // Match container background
    alignSelf: "center",
    marginTop: -1, // Slight overlap to prevent gap
  },
  directionsButton: {
    backgroundColor: "#2196F3",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    width: "100%",
    alignItems: "center",
  },
  directionsText: {
    color: "white",
    fontSize: 13,
    fontWeight: "bold",
  },
});
