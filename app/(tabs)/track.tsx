import { Text, View, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useState, useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import {
  getTrainMovements,
  calculateTrainPosition,
  TrainMovement,
} from "../../utils/IrishRailAPI/returnTrainData";

// export const DART_STATION_CODES: Record<string, string> = {
//   Malahide: "MLHDE",
//   Portmarnock: "PMRNK",
//   Clongriffin: "CLGRF",
//   "Howth Junction & Donaghmede": "HWTHJ",
//   Kilbarrack: "KBRCK",
//   Raheny: "RAHNY",
//   Harmonstown: "HTOWN",
//   Killester: "KLSTR",
//   "Clontarf Road": "CTARF",
//   Connolly: "CNLLY",
//   "Tara Street": "TARA",
//   Pearse: "PERSE",
//   "Grand Canal Dock": "GCDK",
//   "Lansdowne Road": "LDWNE",
//   Sandymount: "SMONT",
//   "Sydney Parade": "SIDNY",
//   Booterstown: "BTSTN",
//   Blackrock: "BROCK",
//   Seapoint: "SEAPT",
//   "Salthill & Monkstown": "SHILL",
//   "Dun Laoghaire": "DLERY",
//   "Sandycove & Glasthule": "SCOVE",
//   Glenageary: "GLGRY",
//   Dalkey: "DLKEY",
//   Killiney: "KILNY",
//   Shankill: "SKILL",
//   Woodbrook: "WBROK",
//   "Bray Daly": "BRAY",
//   Greystones: "GSTNS",
// };

export default function TrackingScreen() {
  const [stationData, setStationData] = useState<Record<string, string>>({});
  const [stations, setStations] = useState<TrainMovement[]>([]);
  const [trainPosition, setTrainPosition] = useState<number | null>(null);
  const [direction, setDirection] = useState<
    "Northbound" | "Southbound" | null
  >(null);
  const [isAtStation, setIsAtStation] = useState(false);
  const [nextStopIndex, setNextStopIndex] = useState<number | null>(null);
  const { destination, trainCode } = useLocalSearchParams();

  // Animated value for flashing next stop
  // const flashOpacity = useSharedValue(1); // Removed

  // Helper function to determine direction from destination
  const getDirectionFromDestination = (
    destination: string
  ): "Northbound" | "Southbound" | null => {
    const dest = destination.toLowerCase();

    // Northbound destinations
    if (dest.includes("malahide") || dest.includes("howth")) {
      return "Northbound";
    }

    // Southbound destinations
    if (dest.includes("greystones") || dest.includes("bray")) {
      return "Southbound";
    }

    return null;
  };

  useEffect(() => {
    const updateTrainPosition = async () => {
      try {
        console.log("\n--- Fetching train position ---");
        const code = Array.isArray(trainCode) ? trainCode[0] : trainCode;
        if (!code) {
          console.log("Train code is missing.");
          return;
        }
        const allMovements = await getTrainMovements(code);

        if (allMovements.length === 0) {
          console.log("No movement data found");
          return;
        }

        // Filter for actual stops (S), origins (O), and destinations (D)
        const movements = allMovements.filter((m) =>
          ["S", "O", "D"].includes(m.LocationType)
        );

        const newStationData = movements.reduce((acc, movement) => {
          acc[movement.LocationFullName] = movement.LocationCode;
          return acc;
        }, {} as Record<string, string>);

        setStationData(newStationData);
        setStations(movements);

        const position = calculateTrainPosition(movements, newStationData);

        setTrainPosition(position.position);
        console.log(`Train position: ${position.position.toFixed(0)}`);
        console.log(`Currently at: ${position.currentStation}`);
        console.log(`Is at station: ${position.isAtStation}`);

        // Find and set the index of the next stop
        if (position.nextStation) {
          const stationList = movements.map((m) => m.LocationFullName);
          const nextIndex = stationList.indexOf(position.nextStation);
          setNextStopIndex(nextIndex);
        } else {
          setNextStopIndex(null);
        }

        // Determine direction from destination
        const destination = movements[0]?.TrainDestination || "";
        const trainDirection = getDirectionFromDestination(destination);
        console.log(`Destination: ${destination}`);
        console.log(`Direction: ${trainDirection}`);

        setDirection(trainDirection);
        setIsAtStation(position.isAtStation);
      } catch (error) {
        console.error("Error updating train position:", error);
      }
    };

    // Initial fetch
    updateTrainPosition();

    // Poll every 10 seconds
    const interval = setInterval(updateTrainPosition, 10000);

    return () => clearInterval(interval);
  }, [trainCode]);

  /* This useEffect is no longer needed as the animation is handled inside useAnimatedStyle
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
  */

  const getStationIndex = (pos: number) => Math.round(pos);

  const isPastStop = (index: number): boolean => {
    if (trainPosition === null) return false;
    // A stop is "past" if the train's position index is greater than the stop's index.
    return trainPosition > index;
  };

  const isPastSegment = (segmentIndex: number): boolean => {
    if (trainPosition === null) return false;
    // A segment is "past" if the train's position is beyond the start of the segment.
    return trainPosition > segmentIndex;
  };

  const isNextStop = (index: number): boolean => {
    return nextStopIndex === index && !isAtStation;
  };

  // Animated Station Marker Component
  const AnimatedStationMarker = ({
    stationIndex,
  }: {
    stationIndex: number;
  }) => {
    const isPast = isPastStop(stationIndex);
    const isNext = isNextStop(stationIndex);
    const isCurrentStation =
      trainPosition !== null &&
      isAtStation &&
      getStationIndex(trainPosition) === stationIndex;

    const animatedStyle = useAnimatedStyle(() => {
      if (isNext) {
        return {
          backgroundColor: withRepeat(
            withSequence(
              withTiming("#25292e", {
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
              }),
              withTiming("#46d213ff", {
                duration: 1000,
                easing: Easing.inOut(Easing.ease),
              })
            ),
            -1,
            true
          ),
          borderColor: "#46d213ff",
          transform: [{ scale: 1.3 }],
        };
      }
      return {};
    });

    return (
      <Animated.View
        style={[
          styles.stationMarker,
          (isPast || isCurrentStation) && styles.pastStationMarker, // Re-enabled
          animatedStyle, // Re-enabled
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {stations.map((station, index) => {
          const segmentPassed = isPastSegment(index);
          const departureTime = station.ScheduledDeparture.substring(0, 5);

          return (
            <View key={index} style={styles.stationContainer}>
              <View style={styles.stationSection}>
                <View style={styles.timeContainer}>
                  {station.LocationType !== "D" && (
                    <Text style={styles.timeText}>{departureTime}</Text>
                  )}
                </View>
                {/* Station marker and label */}
                <View style={styles.stationWrapper}>
                  {index < stations.length - 1 && (
                    <View
                      style={[
                        styles.lineSegment,
                        segmentPassed && styles.pastLineSegment, // Re-enabled
                      ]}
                    />
                  )}
                  <AnimatedStationMarker stationIndex={index} />
                  <Text style={styles.stationText}>
                    {station.LocationFullName}
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
    backgroundColor: "#25292e",
    paddingTop: 90,
    paddingBottom: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  stationContainer: {
    width: "100%",
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  stationSection: {
    position: "relative",
    height: 80,
    flexDirection: "row",
    alignItems: "flex-start",
    marginLeft: 60, // Add margin to make space for times
  },
  stationWrapper: {
    position: "relative",
    alignItems: "center",
    width: 20,
    left: 100,
  },
  lineSegment: {
    width: 4,
    height: 80,
    backgroundColor: "#4a90e2",
  },
  pastLineSegment: {
    backgroundColor: "#46d213ff",
  },
  stationMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 3,
    borderColor: "#4a90e2",
    position: "absolute",
    zIndex: 1,
  },
  pastStationMarker: {
    backgroundColor: "#46d213ff",
    borderColor: "#46d213ff",
    transform: [{ scale: 1.3 }],
  },
  stationText: {
    color: "#fff",
    fontSize: 14,
    position: "absolute",
    left: 25,
    width: 200,
  },
  timeContainer: {
    position: "absolute",
    right: -70,
    alignItems: "flex-end",
  },
  timeText: {
    color: "#aaa",
    fontSize: 12,
    lineHeight: 16,
  },
  arrowContainer: {
    position: "absolute",
    left: -2,
    top: 30,
    zIndex: 2,
  },
  arrow: {
    fontSize: 48,
    color: "#46d213ff",
    fontWeight: "bold",
  },
});
