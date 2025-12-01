import { Pressable, Text, View, StyleSheet, ScrollView } from "react-native";
import * as Location from "expo-location";
import { useState, useRef, useEffect } from "react";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { db } from "../../config/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";

export default function GPS() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null
  );

  // error message handling
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // track whether we're currently collecting GPS data
  const [isCollecting, setIsCollecting] = useState<boolean>(false);

  // track whether live sharing to Firebase is enabled
  const [isLiveSharing, setIsLiveSharing] = useState<boolean>(false);
  const isLiveSharingRef = useRef(false);

  // Update ref when state changes to avoid stale closures in callbacks
  useEffect(() => {
    isLiveSharingRef.current = isLiveSharing;
  }, [isLiveSharing]);

  useEffect(() => {
    console.log("GPS Component Mounted");
    if (db) {
      console.log("Firebase DB initialized:", !!db);
    } else {
      console.error("Firebase DB not initialized!");
    }
  }, []);

  // array to store all collected GPS readings
  // each item will be a LocationObject containing coordinates, timestamp, etc.
  const [gpsData, setGpsData] = useState<Location.LocationObject[]>([]);

  // store the subscription object so we can stop the GPS watcher later
  // the type is defined by expo-location library
  const [locationSubscription, setLocationSubscription] =
    useState<Location.LocationSubscription | null>(null);

  // function to send GPS data to Firebase
  const sendToFirebase = async (locationData: Location.LocationObject) => {
    try {
      console.log("Attempting to send to Firebase...");
      const userId = "stephen_haskins";

      // Correct structure: users/{userId}/gpsReadings
      // First get reference to the user document
      // const userDocRef = doc(db, "users", userId);
      // Then get reference to the gpsReadings subcollection under that user
      // const gpsReadingsRef = collection(userDocRef, "gpsReadings");

      // Use a fixed document ID 'latest' to overwrite the same document
      const latestReadingRef = doc(
        db,
        "users",
        userId,
        "gpsReadings",
        "latest"
      );

      console.log(`Writing to path: users/${userId}/gpsReadings/latest`);

      // Prepare data matching your 8 fields
      const gpsData = {
        timestamp: serverTimestamp(),
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        altitude: locationData.coords.altitude ?? null,
        horizontalAccuracy: locationData.coords.accuracy ?? null,
        altitudeAccuracy: locationData.coords.altitudeAccuracy ?? null,
        speed: locationData.coords.speed ?? null,
        heading: locationData.coords.heading ?? null,
      };

      await setDoc(latestReadingRef, gpsData);
      console.log("Successfully updated Firebase document");
    } catch (error) {
      console.error("Error sending to Firebase:", error);
      setErrorMsg("Firebase error: " + (error as Error).message);
    }
  };

  // function to start continuous GPS collection
  // this will collect a new GPS reading every second
  const startCollecting = async () => {
    try {
      // Request permission to access location
      // https://docs.expo.dev/versions/latest/sdk/location/#locationrequestforegroundpermissionsasync
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        return;
      }

      // watchPositionAsync continuously monitors location changes
      // it returns a subscription object that we can use to stop watching later
      const subscription = await Location.watchPositionAsync(
        {
          // accuracy options: Lowest, Low, Balanced, High, Highest, BestForNavigation
          accuracy: Location.Accuracy.High,
          // timeInterval: minimum time (in ms) between location updates
          timeInterval: 1000, // 1000ms = 1 second
          // distanceInterval: minimum distance (in meters) device must move for update
          // setting to 0 means we get updates based on time only
          distanceInterval: 0,
        },
        // this callback function runs every time we get a new location
        (newLocation) => {
          // update the displayed location to the newest one
          setLocation(newLocation);
          // add this new location to our array of collected data
          // the spread operator (...) copies existing data, then we add new item
          setGpsData((prevData) => [...prevData, newLocation]);

          // if live sharing is enabled, send to Firebase
          if (isLiveSharingRef.current) {
            console.log("Live sharing is enabled, calling sendToFirebase");
            sendToFirebase(newLocation);
          } else {
            console.log("Live sharing is disabled");
          }
        }
      ); // save the subscription so we can stop it later
      setLocationSubscription(subscription);
      // mark that we're now collecting
      setIsCollecting(true);
      // clear any previous error messages
      setErrorMsg(null);
    } catch (error) {
      // if anything goes wrong, show the error message
      setErrorMsg("error starting collection: " + (error as Error).message);
    }
  };

  // function to stop GPS collection
  const stopCollecting = () => {
    // if we have an active subscription, remove it to stop location updates
    if (locationSubscription) {
      locationSubscription.remove();
      setLocationSubscription(null);
    }
    // mark that we're no longer collecting
    setIsCollecting(false);
  };

  // function to restart collection with fresh data
  const restartCollecting = async () => {
    // first stop any active collection
    stopCollecting();
    // clear all previously collected GPS data
    setGpsData([]);
    // clear the displayed location
    setLocation(null);
    // small delay to ensure the previous subscription is fully cleaned up
    await new Promise((resolve) => setTimeout(resolve, 100));
    // start collecting again
    // await startCollecting();
  };

  // function to export collected GPS data as CSV file
  const exportCSV = async () => {
    try {
      // check if we actually have data to export
      if (gpsData.length === 0) {
        setErrorMsg("no data to export");
        return;
      }

      // build the CSV content as a string
      // start with the header row (column names)
      let csvContent = "Timestamp,Latitude,Longitude,Accuracy,Speed,Altitude\n";

      // loop through each GPS reading and add it as a row
      gpsData.forEach((reading) => {
        // create ISO timestamp string from the timestamp number
        const timestamp = new Date(reading.timestamp).toISOString();
        // get coordinates from the reading
        const lat = reading.coords.latitude;
        const lon = reading.coords.longitude;
        // use nullish coalescing (??) to provide default values if data is missing
        const accuracy = reading.coords.accuracy ?? "N/A";
        const speed = reading.coords.speed ?? 0;
        const altitude = reading.coords.altitude ?? "N/A";

        // add this row to our CSV content
        // each value separated by comma, row ends with newline
        csvContent += `${timestamp},${lat},${lon},${accuracy},${speed},${altitude}\n`;
      });

      // create a new file instance in the document directory
      // Paths.document is a Directory representing the app's document folder
      // File constructor takes directory and filename as arguments
      const file = new File(Paths.document, "gps_data.csv");

      // write the CSV string to the file
      // write() is synchronous in the new API
      file.write(csvContent);

      // check if sharing is available on this device
      const isSharingAvailable = await Sharing.isAvailableAsync();
      if (isSharingAvailable) {
        // open the share dialog (airdrop, email, etc.)
        // file.uri gives us the file:// URI needed for sharing
        await Sharing.shareAsync(file.uri);
      } else {
        // fallback message if sharing isn't available
        setErrorMsg(
          "sharing not available on this device. file saved to: " + file.uri
        );
      }
    } catch (error) {
      setErrorMsg("error exporting CSV: " + (error as Error).message);
    }
  };

  // function to toggle live sharing to Firebase
  const toggleLiveSharing = () => {
    setIsLiveSharing((prev) => !prev);

    // If we just enabled live sharing and we're currently collecting, start sending data
    if (!isLiveSharing && isCollecting) {
      setErrorMsg(null);
      // Note: the next GPS update will automatically send to Firebase
      // because the callback checks isLiveSharing state
    }

    if (isLiveSharing) {
      // Just turned off live sharing
      setErrorMsg(null);
    }
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.text}>GPS Data Collection</Text>

        {/* display how many GPS points we've collected so far */}
        <Text style={styles.counterText}>
          Collected: {gpsData.length} points
        </Text>

        {/* button container to hold our three buttons */}
        <View style={styles.buttonContainer}>
          {/* start button - disabled when already collecting */}
          {/* the disabled prop grays out the button when we can't use it */}
          <Pressable
            style={[styles.button, isCollecting && styles.buttonDisabled]}
            onPress={() => {
              startCollecting();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            disabled={isCollecting}
          >
            <Text style={styles.buttonText}>Start Collecting</Text>
          </Pressable>

          {/* stop button - disabled when not collecting */}
          <Pressable
            style={[
              styles.button,
              styles.stopButton,
              !isCollecting && styles.buttonDisabled,
            ]}
            onPress={() => {
              stopCollecting();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            disabled={!isCollecting}
          >
            <Text style={styles.buttonText}>Stop Collecting</Text>
          </Pressable>

          {/* restart button - clears data and starts fresh collection */}
          {/* enabled when collecting or when we have data to clear */}
          <Pressable
            style={[
              styles.button,
              styles.restartButton,
              !isCollecting && gpsData.length === 0 && styles.buttonDisabled,
            ]}
            onPress={() => {
              restartCollecting();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            disabled={!isCollecting && gpsData.length === 0}
          >
            <Text style={styles.buttonText}>Restart Collection</Text>
          </Pressable>

          {/* live sharing toggle button - enables/disables Firebase streaming */}
          <Pressable
            style={[
              styles.button,
              isLiveSharing
                ? styles.liveSharingActive
                : styles.liveSharingButton,
            ]}
            onPress={() => {
              toggleLiveSharing();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.buttonText}>
              {isLiveSharing ? "Stop Live Sharing" : "Start Live Sharing"}
            </Text>
          </Pressable>

          {/* export button - disabled if we have no data */}
          <Pressable
            style={[
              styles.button,
              styles.exportButton,
              gpsData.length === 0 && styles.buttonDisabled,
            ]}
            onPress={() => {
              exportCSV();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            disabled={gpsData.length === 0}
          >
            <Text style={styles.buttonText}>Export CSV</Text>
          </Pressable>
        </View>

        {/* conditional rendering: if errorMsg exists, display the error message */}
        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {/* if location exists, display the most recent GPS reading */}
        {/* this updates in real-time while collecting */}
        {location && (
          <View style={styles.locationInfo}>
            <Text style={styles.sectionTitle}>Position Coordinates</Text>
            <Text style={styles.locationText}>
              Latitude: {location.coords.latitude}°
            </Text>
            <Text style={styles.locationText}>
              Longitude: {location.coords.longitude}°
            </Text>
            <Text style={styles.locationText}>
              Altitude: {location.coords.altitude?.toFixed(2) ?? "N/A"} m
            </Text>

            <Text style={styles.sectionTitle}>Accuracy</Text>
            <Text style={styles.locationText}>
              Horizontal Accuracy:{" "}
              {location.coords.accuracy?.toFixed(2) ?? "N/A"} m
            </Text>
            <Text style={styles.locationText}>
              Altitude Accuracy:{" "}
              {location.coords.altitudeAccuracy?.toFixed(2) ?? "N/A"} m
            </Text>

            <Text style={styles.sectionTitle}>Movement</Text>
            <Text style={styles.locationText}>
              Speed: {location.coords.speed?.toFixed(2) ?? "0.00"} m/s
            </Text>
            <Text style={styles.locationText}>
              Heading: {location.coords.heading?.toFixed(2) ?? "N/A"}°
            </Text>

            <Text style={styles.sectionTitle}>Metadata</Text>
            <Text style={styles.locationText}>
              Timestamp: {new Date(location.timestamp).toLocaleString()}
            </Text>
            <Text style={styles.locationText}>
              Mocked: {location.mocked ? "Yes" : "No"}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  text: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 10,
  },
  // style for the counter showing how many points collected
  counterText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginTop: 10,
    marginBottom: 5,
  },
  // container to hold all buttons in a column
  buttonContainer: {
    width: "100%",
    maxWidth: 300,
    gap: 12, // spacing between buttons
  },
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  // style for stop button - different color to indicate stopping action
  stopButton: {
    backgroundColor: "#FF9500", // orange color
  },
  // style for restart button - red/warning color since it clears data
  restartButton: {
    backgroundColor: "#FF3B30", // red color
  },
  // style for export button - green to indicate saving/success action
  exportButton: {
    backgroundColor: "#34C759", // green color
  },
  // style for live sharing button - purple/blue to indicate streaming action
  liveSharingButton: {
    backgroundColor: "#5856D6", // purple color
  },
  // style for active live sharing - brighter purple to show it's active
  liveSharingActive: {
    backgroundColor: "#AF52DE", // brighter purple
  },
  // style for disabled buttons - gray and semi-transparent
  buttonDisabled: {
    backgroundColor: "#3A3A3C",
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 14,
    marginTop: 20,
    textAlign: "center",
  },
  locationInfo: {
    marginTop: 30,
    padding: 20,
    backgroundColor: "#1C1C1E",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
  },
  sectionTitle: {
    color: "#007AFF",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 15,
    marginBottom: 8,
  },
  locationText: {
    color: "#fff",
    fontSize: 16,
    marginVertical: 3,
  },
  scrollView: {
    backgroundColor: "#25292e",
  },
});
