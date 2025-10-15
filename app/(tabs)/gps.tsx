import { Pressable, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { useState } from 'react';

export default function GPS() {
// useState is a react hook that stores data that can change
// Location.LocationObject is a type that represents a location object, or can be null
  const [location, setLocation] = useState<Location.LocationObject | null>(null);

  // error message handling
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // function to get the location
  // async as gps location can take time to get
  // else app would freeze while retrieving location
  const getLocation = async () => {
    try {
      // Request permission to access location
      // https://docs.expo.dev/versions/latest/sdk/location/#locationrequestforegroundpermissionsasync
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Get current position
      // https://docs.expo.dev/versions/latest/sdk/location/#locationgetcurrentpositionasyncoptions
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setErrorMsg(null);
    } catch (error) {
      setErrorMsg('Error getting location: ' + (error as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.text}>GPS screen</Text>
      
      {/* When pressed call the getLocation function */}
      <Pressable style={styles.button} onPress={getLocation}>
        <Text style={styles.buttonText}>Retrieve GPS information</Text>
      </Pressable>

      {/* Conditional rendering */}
      {/* If errorMsg exists, display the error message */}
      {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
      
      {/* If location exists, display the location information */}
      {location && (
        <View style={styles.locationInfo}>
          <Text style={styles.sectionTitle}>Position Coordinates</Text>
          <Text style={styles.locationText}>Latitude: {location.coords.latitude}°</Text>
          <Text style={styles.locationText}>Longitude: {location.coords.longitude}°</Text>
          <Text style={styles.locationText}>Altitude: {location.coords.altitude?.toFixed(2) ?? 'N/A'} m</Text>
          
          <Text style={styles.sectionTitle}>Accuracy</Text>
          <Text style={styles.locationText}>Horizontal Accuracy: {location.coords.accuracy?.toFixed(2) ?? 'N/A'} m</Text>
          <Text style={styles.locationText}>Altitude Accuracy: {location.coords.altitudeAccuracy?.toFixed(2) ?? 'N/A'} m</Text>
          
          <Text style={styles.sectionTitle}>Movement</Text>
          <Text style={styles.locationText}>Speed: {location.coords.speed?.toFixed(2) ?? '0.00'} m/s</Text>
          <Text style={styles.locationText}>Heading: {location.coords.heading?.toFixed(2) ?? 'N/A'}°</Text>
          
          <Text style={styles.sectionTitle}>Metadata</Text>
          <Text style={styles.locationText}>Timestamp: {new Date(location.timestamp).toLocaleString()}</Text>
          <Text style={styles.locationText}>Mocked: {location.mocked ? 'Yes' : 'No'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  locationInfo: {
    marginTop: 30,
    padding: 20,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
  },
  sectionTitle: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 8,
  },
  locationText: {
    color: '#fff',
    fontSize: 16,
    marginVertical: 3,
  },
});