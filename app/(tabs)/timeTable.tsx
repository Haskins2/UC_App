import { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import { getAllStations, Station } from '@/utils/irishRailApi';


// Simplified distance calculation using Euclidean approximation
// Good enough for finding nearby stations (accurate within ~10km)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const kmPerDegreeLat = 111; // approximate km per degree of latitude
  const kmPerDegreeLon = 111 * Math.cos(lat1 * Math.PI / 180); // adjust for longitude at this latitude
  
  const dLat = (lat2 - lat1) * kmPerDegreeLat;
  const dLon = (lon2 - lon1) * kmPerDegreeLon;
  
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

export default function TimeTable() {
  const [closestStation, setClosestStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function findClosestStation() {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Permission to access location was denied');
          setLoading(false);
          return;
        }

        // Get user's current location
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;

        // Fetch all DART stations
        const stations = await getAllStations();

        // Find the closest station
        let closest: Station | null = null;
        let minDistance = Infinity;

        stations.forEach((station) => {
          const distance = calculateDistance(
            latitude,
            longitude,
            station.StationLatitude,
            station.StationLongitude
          );

          if (distance < minDistance) {
            minDistance = distance;
            closest = station;
          }
        });

        setClosestStation(closest);
      } catch (err) {
        setError('Failed to find closest station');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    findClosestStation();
  }, []);

  return (
    <View style={styles.container}>
      {loading && <Text style={styles.text}>Finding closest station...</Text>}
      {error && <Text style={styles.text}>{error}</Text>}
      {closestStation && (
        <>
          <Text style={styles.text}>
            Closest DART station: {closestStation.StationDesc}
          </Text>
          <Text style={styles.text}>
            Station Code: {closestStation.StationCode}
          </Text>
        </>
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
  },
  text: {
    color: '#fff',
  },
});
