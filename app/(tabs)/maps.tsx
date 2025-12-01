import { Text, View, StyleSheet, Image, Platform } from "react-native";
import MapView, { Marker, Polyline, Polygon } from "react-native-maps";
import { useState, useEffect } from "react";
import * as Location from "expo-location";
import {
  getAllStations,
  Station,
} from "@/utils/IrishRailAPI/returnAllStations";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/config/firebase";

// Train station icon component using custom image
const TrainIcon = ({ isClosest }: { isClosest?: boolean }) => (
  <View style={{ alignItems: "center" }}>
    <View
      style={[
        styles.markerContainer,
        isClosest && styles.closestMarkerContainer,
      ]}
    >
      <Image
        source={require("@/assets/dart_icon.jpeg")}
        style={styles.trainIconImage}
        resizeMode="contain"
      />
    </View>
    {isClosest && (
      <View style={styles.closestBadge}>
        <Text style={styles.closestText}>Closest</Text>
      </View>
    )}
  </View>
);

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
                title={station.StationDesc}
                description={`Station Code: ${station.StationCode}`}
                zIndex={isClosest ? 999 : 1}
              >
                <TrainIcon isClosest={isClosest} />
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
    paddingHorizontal: 8,
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
});
