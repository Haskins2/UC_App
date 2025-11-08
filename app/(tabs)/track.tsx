import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
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
  const [trainPosition, setTrainPosition] = useState<number | null>(null);
  const [direction, setDirection] = useState<'Northbound' | 'Southbound' | null>(null);
  const [isAtStation, setIsAtStation] = useState(false);
  const [nextStopIndex, setNextStopIndex] = useState<number | null>(null);

  // Animated value for flashing next stop
  const flashOpacity = useSharedValue(1);

  // Helper function to determine direction from destination
  const getDirectionFromDestination = (destination: string): 'Northbound' | 'Southbound' | null => {
    const dest = destination.toLowerCase();
    
    // Northbound destinations
    if (dest.includes('malahide') || dest.includes('howth')) {
      return 'Northbound';
    }
    
    // Southbound destinations
    if (dest.includes('greystones') || dest.includes('bray')) {
      return 'Southbound';
    }
    
    return null;
  };

  useEffect(() => {
    const updateTrainPosition = async () => {
      try {
        console.log('\n--- Fetching train position ---');
        const movements = await getTrainMovements('E129');
        
        if (movements.length === 0) {
          console.log('No movement data found');
          return;
        }

        const position = calculateTrainPosition(movements);
        console.log(`Train position: ${position.position.toFixed(2)}`);
        console.log(`Is at station: ${position.isAtStation}`);
        
        // Determine direction from destination
        const destination = movements[0]?.TrainDestination || '';
        const trainDirection = getDirectionFromDestination(destination);
        console.log(`Destination: ${destination}`);
        console.log(`Direction: ${trainDirection}`);
        
        // Convert position to 0-based index
        const internalPosition = position.position - 1;
        
        // Calculate next stop index
        const currentIndex = Math.round(internalPosition);
        let nextIndex: number;
        
        if (position.isAtStation) {
          // If at station, next stop is in the direction of travel
          nextIndex = trainDirection === 'Southbound' ? currentIndex + 1 : currentIndex - 1;
        } else {
          // If between stations, next stop is the one we're heading towards
          nextIndex = trainDirection === 'Southbound' ? Math.ceil(internalPosition) : Math.floor(internalPosition);
        }
        
        console.log(`Current index: ${currentIndex}, Next stop index: ${nextIndex}`);
        
        setTrainPosition(internalPosition);
        setDirection(trainDirection);
        setIsAtStation(position.isAtStation);
        setNextStopIndex(nextIndex);
      } catch (error) {
        console.error('Error updating train position:', error);
      }
    };

    // Initial fetch
    updateTrainPosition();

    // Poll every 5 seconds
    const interval = setInterval(updateTrainPosition, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Slower flashing animation for next stop
    flashOpacity.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const getStationIndex = (pos: number) => Math.round(pos);

  const isPastStop = (index: number): boolean => {
    if (trainPosition === null || direction === null) return false;
    const currentIndex = getStationIndex(trainPosition);
    
    if (direction === 'Southbound') {
      return index < currentIndex;
    } else {
      return index > currentIndex;
    }
  };

  const isPastSegment = (segmentIndex: number): boolean => {
    if (trainPosition === null || direction === null) return false;
    
    // A segment connects station[segmentIndex] to station[segmentIndex+1]
    // The segment should be green if the train has passed BOTH endpoints
    
    if (direction === 'Southbound') {
      // For southbound, segment is past if train position > segmentIndex + 1
      // This means train has passed both the start (segmentIndex) and end (segmentIndex + 1) of segment
      return trainPosition > segmentIndex + 1;
    } else {
      // For northbound, segment is past if train position < segmentIndex
      // This means train has passed both the end (segmentIndex + 1) and start (segmentIndex) of segment
      return trainPosition < segmentIndex + 1;
    }
  };

  const isNextStop = (index: number): boolean => {
    return nextStopIndex === index && !isAtStation;
  };

  // Animated Station Marker Component
  const AnimatedStationMarker = ({ stationIndex }: { stationIndex: number }) => {
    const isPast = isPastStop(stationIndex);
    const isNext = isNextStop(stationIndex);
    const isCurrentStation = trainPosition !== null && 
      isAtStation && 
      getStationIndex(trainPosition) === stationIndex;

    const animatedStyle = useAnimatedStyle(() => {
      if (isNext) {
        return {
          backgroundColor: '#46d213ff',
          borderColor: '#46d213ff',
          opacity: flashOpacity.value,
          transform: [{ scale: 1.3 }],
        };
      }
      return {};
    });

    return (
      <Animated.View style={[
        styles.stationMarker,
        (isPast || isCurrentStation) && styles.pastStationMarker,
        animatedStyle
      ]} />
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {stations.map((station, index) => {
          const isPast = isPastStop(index);
          const isCurrentStation = trainPosition !== null && 
            isAtStation && 
            getStationIndex(trainPosition) === index;
          
          // Line segment from this station to the next
          // Only color it green if train has completely passed this segment
          const segmentPassed = isPastSegment(index);

          return (
            <View key={index} style={styles.stationContainer}>
              <View style={styles.stationSection}>
                {/* Station marker and label */}
                <View style={styles.stationWrapper}>
                  <View style={[
                    styles.lineSegment,
                    segmentPassed && styles.pastLineSegment
                  ]} />
                  <AnimatedStationMarker stationIndex={index} />
                  <Text style={styles.stationText}>
                    {station}
                  </Text>
                </View>
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
  pastLineSegment: {
    backgroundColor: '#46d213ff',
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
  pastStationMarker: {
    backgroundColor: '#46d213ff',
    borderColor: '#46d213ff',
    transform: [{ scale: 1.3 }],
  },
  stationText: {
    color: '#fff',
    fontSize: 14,
    position: 'absolute',
    left: 25,
    top: -8,
    width: 200,
  },
  arrowContainer: {
    position: 'absolute',
    left: -2,
    top: 30,
    zIndex: 2,
  },
  arrow: {
    fontSize: 48,
    color: '#46d213ff',
    fontWeight: 'bold',
  },
});
