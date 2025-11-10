import { Text, View, StyleSheet, Image, Platform } from "react-native";
import MapView, { Marker, Polyline, Polygon } from "react-native-maps";
import { useState, useEffect } from "react";
import * as Location from "expo-location";
import {
  getAllStations,
  Station,
} from "@/utils/IrishRailAPI/returnAllStations";

// Train station icon component using custom image
const TrainIcon = () => (
  <View style={styles.markerContainer}>
    <Image
      source={require("@/assets/dart_icon.jpeg")}
      style={styles.trainIconImage}
      resizeMode="contain"
    />
  </View>
);

export default function MapsScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
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
          {stations.map((station) => (
            <Marker
              key={station.StationId}
              coordinate={{
                latitude: station.StationLatitude,
                longitude: station.StationLongitude,
              }}
              title={station.StationDesc}
              description={`Station Code: ${station.StationCode}`}
            >
              <TrainIcon />
            </Marker>
          ))}
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
  trainIconImage: {
    width: 40,
    height: 40,
  },
});
