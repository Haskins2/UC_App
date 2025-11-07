import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing 
} from 'react-native-reanimated';
import { getTrainMovements, calculateTrainPosition } from '../../services/trainService';

export const DART_STATION_CODES: Record<string, string> = {
  Malahide: "MLHDE",
  Portmarnock: "PMRNK",
  Clongriffin: "CLGRF",
  "Howth Junction & Donaghmede": "HWTHJ",
  Kilbarrack: "KBRCK",
  Raheny: "RAHNY",
  Harmonstown: "HTOWN",
  Killester: "KLSTR",
  "Clontarf Road": "CTARF",
  Connolly: "CNLLY",
  "Tara Street": "TARA",
  Pearse: "PERSE",
  "Grand Canal Dock": "GCDK",
  "Lansdowne Road": "LDWNE",
  Sandymount: "SMONT",
  "Sydney Parade": "SIDNY",
  Booterstown: "BTSTN",
  Blackrock: "BROCK",
  Seapoint: "SEAPT",
  "Salthill & Monkstown": "SHILL",
  "Dun Laoghaire": "DLERY",
  "Sandycove & Glasthule": "SCOVE",
  Glenageary: "GLGRY",
  Dalkey: "DLKEY",
  Killiney: "KILNY",
  Shankill: "SKILL",
  Woodbrook: "WBROK",
  "Bray Daly": "BRAY",
  Greystones: "GSTNS",
};

export default function TrackingScreen() {
  const stations = Object.keys(DART_STATION_CODES);
  const animatedPosition = useSharedValue(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAtStation, setIsAtStation] = useState(false);
  const [stationArrivalTime, setStationArrivalTime] = useState<number | null>(null);
  const [currentStationPosition, setCurrentStationPosition] = useState<number | null>(null);

  useEffect(() => {
    const updateTrainPosition = async () => {
      try {
        // console.log('\n--- Fetching train position ---');
        const movements = await getTrainMovements('E246');
        
        if (movements.length === 0) {
          console.log('No movement data found');
          return;
        }

        const position = calculateTrainPosition(movements);
        // console.log(`Setting dart position to: ${position.position.toFixed(2)}`);
        // console.log(`Is at station: ${position.isAtStation}`);
        
        // Convert position to 0-based index (position comes as 1-32, we need 0-31)
        const internalPosition = position.position - 1;
        
        // For initial position, set immediately without animation
        if (!isInitialized) {
          animatedPosition.value = internalPosition;
          setIsInitialized(true);
          if (position.isAtStation) {
            setIsAtStation(true);
            setStationArrivalTime(Date.now());
            setCurrentStationPosition(internalPosition);
          } else {
            setIsAtStation(false);
          }
        } else if (position.isAtStation) {
          // Train is at a station
          const roundedPosition = Math.round(internalPosition);
          
          // Check if this is a new station arrival
          if (!isAtStation || currentStationPosition !== roundedPosition) {
            // Just arrived at station - start 20 second timer
            setIsAtStation(true);
            setStationArrivalTime(Date.now());
            setCurrentStationPosition(roundedPosition);
            animatedPosition.value = roundedPosition;
            // console.log(`Arrived at station ${roundedPosition}, starting 20s delay`);
          } else if (stationArrivalTime) {
            // Check if 20 seconds have passed
            const timeAtStation = Date.now() - stationArrivalTime;
            if (timeAtStation < 20000) {
              // Still within 20 second delay - stay at station
              animatedPosition.value = roundedPosition;
              // console.log(`Waiting at station, ${((20000 - timeAtStation) / 1000).toFixed(1)}s remaining`);
            }
            // After 20 seconds, we fall through to not update position
            // until train actually starts moving (isAtStation becomes false)
          }
        } else {
          // Train is moving (not at station)
          setIsAtStation(false);
          setStationArrivalTime(null);
          setCurrentStationPosition(null);
          
          // Calculate duration based on expected arrival time
          let animationDuration = 4500; // Default fallback
          
          if (position.expectedArrivalTime) {
            const now = new Date();
            const expectedArrival = new Date(position.expectedArrivalTime);
            const timeUntilArrival = expectedArrival.getTime() - now.getTime();
            
            // Use the actual time until arrival, but cap it for reasonable animation
            if (timeUntilArrival > 0 && timeUntilArrival < 300000) { // Max 5 minutes
              animationDuration = timeUntilArrival;
              // console.log(`Animating over ${(animationDuration / 1000).toFixed(1)}s to arrive at ${expectedArrival.toLocaleTimeString()}`);
            }
          }
          
          // Animate to new position with calculated duration
          animatedPosition.value = withTiming(internalPosition, {
            duration: animationDuration,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          });
        }
      } catch (error) {
        console.error('Error updating train position:', error);
      }
    };

    // Initial fetch
    updateTrainPosition();

    // Poll every 5 seconds
    const interval = setInterval(updateTrainPosition, 5000);

    return () => clearInterval(interval);
  }, [isInitialized, isAtStation, stationArrivalTime, currentStationPosition]);

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {stations.map((station, index) => {
          const AnimatedDart = () => {
            const animatedStyle = useAnimatedStyle(() => {
              // Calculate if DART should be in this station's segment
              // Each station occupies position index to index+1
              const segmentStart = index;
              const segmentEnd = index + 1;
              
              // Check if train is in this segment
              const isInSegment = animatedPosition.value >= segmentStart && animatedPosition.value < segmentEnd;
              
              if (!isInSegment) {
                return {
                  opacity: 0,
                };
              }
              
              // Calculate progress within this segment (0 to 1)
              const segmentProgress = animatedPosition.value - segmentStart;
              
              // Calculate pixel position
              const pixelPosition = segmentProgress * 80;
              
              return {
                opacity: 1,
                top: pixelPosition,
                transform: [{ translateY: -28 }],
              };
            });

            return (
              <Animated.View style={[styles.dartContainer, animatedStyle]}>
                <View style={styles.dartBox} />
                <View style={styles.dartBox} />
                <View style={styles.dartBox} />
              </Animated.View>
            );
          };

          const AnimatedStationMarker = ({ stationIndex }: { stationIndex: number }) => {
            const animatedStyle = useAnimatedStyle(() => {
              // Highlight station when train is very close (within 0.1 units)
              const isActive = Math.abs(animatedPosition.value - stationIndex) < 0.1;
              
              return {
                backgroundColor: isActive ? '#46d213ff' : '#fff',
                borderColor: isActive ? '#46d213ff' : '#4a90e2',
                transform: [{ scale: isActive ? 1.3 : 1 }],
              };
            });

            return (
              <Animated.View style={[styles.stationMarker, animatedStyle]} />
            );
          };

          return (
            <View key={index} style={styles.stationContainer}>
              {/* Station section - 80px total height */}
              <View style={styles.stationSection}>
                {/* Station marker and label at the top */}
                <View style={styles.stationWrapper}>
                  <View style={styles.lineSegment} />
                  <AnimatedStationMarker stationIndex={index} />
                  <Text style={styles.stationText}>
                    {station}
                  </Text>
                </View>
                
                {/* Only render DART when not at station and not last station */}
                {index < stations.length - 1 && !isAtStation && <AnimatedDart />}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    paddingTop: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  stationContainer: {
    width: '100%',
    alignItems: 'flex-start',
  },
  stationSection: {
    position: 'relative',
    height: 80,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stationWrapper: {
    position: 'relative',
    alignItems: 'center',
    width: 20,
  },
  lineSegment: {
    width: 4,
    height: 80,
    backgroundColor: '#4a90e2',
  },
  stationMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#4a90e2',
    position: 'absolute',
    zIndex: 1,
  },
  stationText: {
    color: '#fff',
    fontSize: 14,
    position: 'absolute',
    left: 25,
    top: -8,
    width: 200,
  },
  dartContainer: {
    position: 'absolute',
    flexDirection: 'column',
    zIndex: 2,
    left: 6,
  },
  dartBox: {
    width: 10,
    height: 15,
    backgroundColor: '#46d213ff',
    borderRadius: 1,
    marginVertical: 1,
  }
});
