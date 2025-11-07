import { useState, useEffect, useCallback } from 'react';
import { Text, View, StyleSheet, ScrollView, PixelRatio } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeInDown, 
  FadeInUp,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { getAllStations, Station } from '@/utils/irishRailApi';
import { getStationDataByCode, TrainData } from '@/utils/irishRailStationData';
import { getWalkingRoute, metersToKm, secondsToMinutes } from '@/utils/openRouteService';


// Configuration
const TRAIN_LOOKUP_MINUTES = 60; // Minutes to look ahead for trains

//  Euclidean approximation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const kmPerDegreeLat = 111; // approximate km per degree of latitude
  const kmPerDegreeLon = 111 * Math.cos(lat1 * Math.PI / 180); // adjust for longitude at this latitude
  
  const dLat = (lat2 - lat1) * kmPerDegreeLat;
  const dLon = (lon2 - lon1) * kmPerDegreeLon;
  
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Reusable train card component
type TrainCardProps = { train: TrainData; index: number };

function TrainCard({ train, index }: TrainCardProps) {
  const lateValue = parseInt(train.Late) || 0;
  return (
    <Animated.View
      entering={SlideInRight.duration(150).delay(index * 40).springify()}
      style={styles.trainCard}
    >
      <Text style={styles.trainTitle}>
        {train.TrainType === 'Train' ? 'Commuter' : train.TrainType} to {train.Destination}
      </Text>
      <Text style={styles.text}>Due in: {train.DueIn} mins</Text>
      <Text style={styles.text}>Direction: {train.Direction}</Text>
      {lateValue === 0 ? (
        <Text style={styles.onTimeText}>On time</Text>
      ) : (
        <Text style={lateValue < 0 ? styles.earlyText : styles.lateText}>
          {lateValue < 0 ? 'Early' : 'Late'}: {Math.abs(lateValue)} mins
        </Text>
      )}
    </Animated.View>
  );
}

export default function TimeTable() {
  // [current_value, function_to_update_value] = ReactHook<Type>(initial_value)
  const [closestStation, setClosestStation] = useState<Station | null>(null);
  // example call: setClosestStation(closest)
  
  const [trains, setTrains] = useState<TrainData[]>([]);
  const [walkingDistance, setWalkingDistance] = useState<string>('');
  const [walkingTime, setWalkingTime] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);

  // Animated value for loading pulse
  const loadingOpacity = useSharedValue(1);

  useEffect(() => {
    // Start loading animation
    loadingOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite repeat
      false
    );
  }, []);

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
  }));

  // Reset animation key when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setAnimationKey(prev => prev + 1);
    }, [])
  );

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

        if (closest) {
          // Fetch walking route data
          try {
            const walkingRoute = await getWalkingRoute(
              latitude,
              longitude,
              closest.StationLatitude,
              closest.StationLongitude
            );
            setWalkingDistance(metersToKm(walkingRoute.distance));
            setWalkingTime(secondsToMinutes(walkingRoute.duration));
          } catch (walkError) {
            console.error('Failed to get walking route:', walkError);
            // Fallback to straight-line estimate
            setWalkingDistance((minDistance * 1.4).toFixed(2));
            setWalkingTime(Math.round(minDistance * 1.4 * 12).toString()); // ~12 min per km
          }

          // Fetch train data for the closest station
          const trainData = await getStationDataByCode(
            closest.StationCode,
            TRAIN_LOOKUP_MINUTES
          );
          setTrains(trainData);
        }
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
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {loading && (
          <Animated.View style={loadingAnimatedStyle}>
            <Text style={styles.text}>Finding closest station...</Text>
          </Animated.View>
        )}
        {error && (
          <Text style={styles.text}>{error}</Text>
        )}
        {closestStation && (
          <>
            <Animated.View entering={FadeInDown.duration(500).delay(100)}>
              <Text style={styles.heading}>
                Closest DART station: {closestStation.StationDesc}
              </Text>
            
              {/* <Text style={styles.subheading}>
                Station Code: {closestStation.StationCode}
              </Text> */}
              
              {walkingDistance && (
                <Text style={styles.subheading}>
                  ~{walkingTime} mins Walk
                </Text>
              )}
              
              <Text style={styles.subheading}>
                Trains arriving in next {TRAIN_LOOKUP_MINUTES} minutes:
              </Text>
            </Animated.View>

            
            {trains.length === 0 ? (
              <Animated.View entering={FadeInUp.duration(400).delay(500)}>
                <Text style={styles.text}>No trains scheduled</Text>
              </Animated.View>
            ) : (
              trains.map((train, index) => (
                <TrainCard
                  key={`${animationKey}-${train.TrainCode}-${index}`}
                  train={train}
                  index={index}
                />
              ))
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
  },
  content: {
    padding: PixelRatio.roundToNearestPixel(20),
  },
  heading: {
    color: '#fff',
    fontSize: PixelRatio.roundToNearestPixel(20),
    fontWeight: 'bold',
    marginBottom: PixelRatio.roundToNearestPixel(10),
  },
  subheading: {
    color: '#fff',
    fontSize: PixelRatio.roundToNearestPixel(16),
    marginBottom: PixelRatio.roundToNearestPixel(15),
  },
  text: {
    color: '#fff',
    fontSize: PixelRatio.roundToNearestPixel(14),
    marginBottom: PixelRatio.roundToNearestPixel(5),
  },
  trainCard: {
    backgroundColor: '#3a3f47',
    padding: PixelRatio.roundToNearestPixel(15),
    borderRadius: PixelRatio.roundToNearestPixel(8),
    marginBottom: PixelRatio.roundToNearestPixel(10),
    borderWidth: StyleSheet.hairlineWidth, // 1 physical pixel border
    borderColor: '#4a4f57',
  },
  trainTitle: {
    color: '#fff',
    fontSize: PixelRatio.roundToNearestPixel(18),
    fontWeight: 'bold',
    marginBottom: PixelRatio.roundToNearestPixel(8),
  },
  lateText: {
    color: '#ff6b6b',
    fontSize: PixelRatio.roundToNearestPixel(14),
    fontWeight: 'bold',
  },
  earlyText: {
    color: '#51cf66',
    fontSize: PixelRatio.roundToNearestPixel(14),
    fontWeight: 'bold',
  },
  onTimeText: {
    color: '#51cf66',
    fontSize: PixelRatio.roundToNearestPixel(14),
    fontWeight: 'bold',
  },
});
