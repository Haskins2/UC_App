import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  PixelRatio,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
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
  runOnJS,
} from "react-native-reanimated";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getAllStations,
  Station,
} from "@/utils/IrishRailAPI/returnAllStations";
import {
  getStationDataByCode,
  TrainData,
} from "@/utils/IrishRailAPI/returnStationData";
import {
  getWalkingRoute,
  metersToKm,
  secondsToMinutes,
} from "@/utils/returnWalkingData";
import { getDistance } from "geolib";
import { useRouter } from "expo-router";

export const DART_STATION_CODES: Record<string, string> = {
  Howth: "HOWTH",
  Sutton: "SUTTN",
  Bayside: "BYSDE",
  Malahide: "MHIDE",
  Portmarnock: "PMNCK",
  Clongriffin: "GRGRD",
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
  Bray: "BRAY",
  Greystones: "GSTNS",
};

// Configuration
const TRAIN_LOOKUP_MINUTES = 60; // Minutes to look ahead for trains

//  geolib function to find closest station
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return (
    getDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    ) / 1000
  );
}

// Reusable train card component
type TrainCardProps = { train: TrainData; index: number };

function TrainCard({ train, index }: TrainCardProps) {
  const router = useRouter();
  const lateValue = parseInt(train.Late) || 0;

  const handleCardPress = () => {
    console.log("Clicked on:", train.Destination, " -- index:", index);
    router.push({
      pathname: "/track",
      params: { destination: train.Destination, trainCode: train.TrainCode },
    });
  };

  return (
    // loading animation (slide in)

    <TouchableOpacity
      // pass definition of function to prevent from running immediately
      // especially when given arguements
      onPress={() => handleCardPress()}
    >
      <Animated.View
        entering={SlideInRight.duration(150)
          .delay(index * 40)
          .springify()}
        style={styles.trainCard}
      >
        {/* fade in */}
        <Animated.View
          entering={FadeIn.duration(200).delay(index * 40)}
          style={styles.trainCardContent}
        >
          {/* card contents */}
          <View style={styles.trainInfo}>
            <Text style={styles.trainTitle}>
              {train.TrainType === "Train"
                ? `Commuter to ${train.Destination}`
                : train.TrainType === "DART"
                ? train.Destination
                : `${train.TrainType} to ${train.Destination}`}
            </Text>
            <Text style={styles.text}>{train.Direction}</Text>
            {/* train status */}
            {lateValue === 0 ? (
              <Text style={styles.onTimeText}>On time</Text>
            ) : (
              <Text style={lateValue < 0 ? styles.earlyText : styles.lateText}>
                {lateValue < 0 ? "Early" : "Late"}: {Math.abs(lateValue)} mins
              </Text>
            )}
          </View>
          {/* vertical separator */}
          <View
            style={{
              width: PixelRatio.roundToNearestPixel(1),
              height: "80%",
              backgroundColor: "rgba(255,255,255,0.12)",
              marginHorizontal: PixelRatio.roundToNearestPixel(10),
              alignSelf: "center",
              minWidth: PixelRatio.roundToNearestPixel(2),
              borderRadius: 1,
            }}
          />
          <View style={styles.dueInContainer}>
            {parseInt(train.DueIn) === 0 ? (
              <Text style={styles.text}>Arrived</Text>
            ) : (
              <>
                <Text style={styles.dueInNumber}>{train.DueIn}</Text>
                <Text style={styles.dueInLabel}>
                  {parseInt(train.DueIn) === 1 ? "min" : "mins"}
                </Text>
              </>
            )}
          </View>
        </Animated.View>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TimeTable() {
  const insets = useSafeAreaInsets();
  // [current_value, function_to_update_value] = ReactHook<Type>(initial_value)
  const [closestStation, setClosestStation] = useState<Station | null>(null);
  // example call: setClosestStation(closest)

  const [trains, setTrains] = useState<TrainData[]>([]);
  const [walkingDistance, setWalkingDistance] = useState<string>("");
  const [walkingTime, setWalkingTime] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingTrains, setLoadingTrains] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [showTrains, setShowTrains] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dropdown state
  const [selectedStation, setSelectedStation] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);
  const rotation = useSharedValue(0);
  const dropdownHeight = useSharedValue(0);

  const options = Object.keys(DART_STATION_CODES)
    // .sort((a, b) => a.localeCompare(b)) // to sort stations in alphabetical order
    .map((stationName, index) => ({
      id: String(index + 1),
      label: stationName,
    }));

  // loading pulse
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

  const arrowStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const dropdownButtonStyle = useAnimatedStyle(() => {
    return {
      borderBottomLeftRadius: withTiming(isOpen ? 0 : 8, { duration: 300 }),
      borderBottomRightRadius: withTiming(isOpen ? 0 : 8, { duration: 300 }),
    };
  });

  const dropdownStyle = useAnimatedStyle(() => {
    return {
      height: dropdownHeight.value,
      opacity: withTiming(isOpen ? 1 : 0, { duration: 300 }),
    };
  });

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    rotation.value = withTiming(isOpen ? 0 : 180, { duration: 300 });
    dropdownHeight.value = withTiming(
      isOpen ? 0 : Math.min(options.length * 50, 300),
      { duration: 300 }
    );
  };

  const handleStationSelect = (stationName: string) => {
    setSelectedStation(stationName);
    toggleDropdown();
    // Hide trains momentarily, then reset animation key
    setShowTrains(false);
    setTimeout(() => {
      setAnimationKey((prev) => prev + 1);
      setShowTrains(true);
    }, 100);
  };

  // Function to fetch trains for current station
  const fetchTrains = useCallback(async () => {
    if (!selectedStation) return;

    try {
      setLoadingTrains(true);
      const stationCode = DART_STATION_CODES[selectedStation];
      const trainData = await getStationDataByCode(
        stationCode,
        TRAIN_LOOKUP_MINUTES
      );
      setTrains(trainData);
    } catch (err) {
      console.error("Failed to fetch train data:", err);
      setError("Failed to fetch train data");
    } finally {
      setLoadingTrains(false);
    }
  }, [selectedStation]);

  // Pull-to-refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setShowTrains(false);
    await fetchTrains();
    setTimeout(() => {
      setAnimationKey((prev) => prev + 1);
      setShowTrains(true);
      setRefreshing(false);
    }, 100);
  }, [fetchTrains]);

  // Fetch trains for selected station
  useEffect(() => {
    fetchTrains();
  }, [fetchTrains]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!selectedStation) return;

    const interval = setInterval(() => {
      fetchTrains();
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, [selectedStation, fetchTrains]);

  useEffect(() => {
    async function findClosestStation() {
      try {
        // Request location permissions
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setError("Permission to access location was denied");
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
          // Set as default selected station
          setSelectedStation(closest.StationDesc);

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
            console.error("Failed to get walking route:", walkError);
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
        setError("Failed to find closest station");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    findClosestStation();
  }, []);

  return (
    <ScrollView
      // to offset refreshcontrol workaround
      style={styles.container}
      contentInset={{ top: insets.top }}
      contentOffset={{ y: -insets.top, x: 0 }}
      refreshControl={
        <RefreshControl
          progressViewOffset={insets.top}
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#fff"
          colors={["#fff"]}
        />
      }
    >
      <View style={styles.content}>
        {/* {Kinda choppy once loaded} */}
        {loading && (
          <Animated.View style={loadingAnimatedStyle}>
            <Text style={styles.text}>Finding closest station...</Text>
          </Animated.View>
        )}
        {error && <Text style={styles.text}>{error}</Text>}
        {closestStation && (
          <>
            {/* Dropdown for station selection */}
            <Animated.View
              entering={FadeInDown.duration(500).delay(200)}
              style={styles.dropdownWrapper}
            >
              <Animated.View style={[styles.dropdown, dropdownButtonStyle]}>
                <TouchableOpacity
                  style={styles.dropdownTouchable}
                  onPress={toggleDropdown}
                >
                  <Text style={styles.dropdownText}>
                    {selectedStation || "Select a station"}
                  </Text>
                  <Animated.Text style={[styles.dropdownArrow, arrowStyle]}>
                    ▼
                  </Animated.Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={[styles.optionsContainer, dropdownStyle]}>
                <ScrollView
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  style={styles.optionsScrollView}
                >
                  {options.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={[
                        styles.option,
                        selectedStation === item.label && styles.selectedOption,
                      ]}
                      onPress={() => handleStationSelect(item.label)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selectedStation === item.label &&
                            styles.selectedOptionText,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Animated.View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(500).delay(300)}>
              <Text style={styles.subheading}>
                Trains arriving in next {TRAIN_LOOKUP_MINUTES} minutes:
              </Text>
            </Animated.View>

            {loadingTrains ? (
              <Animated.View style={loadingAnimatedStyle}>
                <Text style={styles.text}>Loading trains...</Text>
              </Animated.View>
            ) : trains.length === 0 ? (
              <Animated.View entering={FadeInUp.duration(400).delay(500)}>
                <Text style={styles.text}>No trains scheduled</Text>
              </Animated.View>
            ) : (
              // show train cards
              showTrains &&
              trains
                .sort((a, b) => parseInt(a.DueIn) - parseInt(b.DueIn))
                .map((train, index) => (
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
    backgroundColor: "#25292e",
  },
  content: {
    padding: PixelRatio.roundToNearestPixel(20),
    paddingBottom: 100,
  },
  heading: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(20),
    fontWeight: "bold",
    marginBottom: PixelRatio.roundToNearestPixel(10),
  },
  subheading: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(16),
    marginBottom: PixelRatio.roundToNearestPixel(15),
  },
  text: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(14),
    marginBottom: PixelRatio.roundToNearestPixel(5),
  },
  trainCard: {
    backgroundColor: "#3a3f47",
    padding: PixelRatio.roundToNearestPixel(15),
    borderRadius: PixelRatio.roundToNearestPixel(8),
    marginBottom: PixelRatio.roundToNearestPixel(10),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#4a4f57",
  },
  trainCardContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trainInfo: {
    flex: 1,
    marginRight: PixelRatio.roundToNearestPixel(15),
  },
  trainTitle: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(18),
    fontWeight: "bold",
    marginBottom: PixelRatio.roundToNearestPixel(8),
  },
  lateText: {
    color: "#ff6b6b",
    fontSize: PixelRatio.roundToNearestPixel(14),
    fontWeight: "bold",
  },
  earlyText: {
    color: "#51cf66",
    fontSize: PixelRatio.roundToNearestPixel(14),
    fontWeight: "bold",
  },
  onTimeText: {
    color: "#51cf66",
    fontSize: PixelRatio.roundToNearestPixel(14),
    fontWeight: "bold",
  },
  dropdownWrapper: {
    width: "100%",
    marginVertical: PixelRatio.roundToNearestPixel(15),
    zIndex: 1000,
  },
  dropdown: {
    backgroundColor: "#3a3f47",
    borderRadius: PixelRatio.roundToNearestPixel(8),
    borderWidth: 1,
    borderColor: "#a9a8a8ff",
  },
  dropdownTouchable: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: PixelRatio.roundToNearestPixel(15),
  },
  dropdownText: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(24),
    fontWeight: "400", //
  },
  dropdownArrow: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(12),
  },
  optionsContainer: {
    position: "absolute",
    top: PixelRatio.roundToNearestPixel(60),
    left: 0,
    right: 0,
    backgroundColor: "#3a3f47",
    borderBottomLeftRadius: PixelRatio.roundToNearestPixel(8),
    borderBottomRightRadius: PixelRatio.roundToNearestPixel(8),
    borderWidth: 1,
    borderTopWidth: 0.1,
    borderColor: "#a9a8a8ff",
    minHeight: 400,
    overflow: "hidden",
    zIndex: 1001,
  },
  optionsScrollView: {
    maxHeight: PixelRatio.roundToNearestPixel(300),
    minHeight: 400,
    top: PixelRatio.roundToNearestPixel(10),
  },
  option: {
    padding: PixelRatio.roundToNearestPixel(15),
    borderTopWidth: 1,
    borderTopColor: "#4a5057",
  },
  optionText: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(18),
  },
  selectedOption: {
    backgroundColor: "#4a5f77",
  },
  selectedOptionText: {
    color: "#51cf66",
    fontWeight: "bold",
  },
  dueInContainer: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: PixelRatio.roundToNearestPixel(60),
  },
  dueInNumber: {
    color: "#fff",
    fontSize: PixelRatio.roundToNearestPixel(36),
    fontWeight: "bold",
    lineHeight: PixelRatio.roundToNearestPixel(40),
  },
  dueInLabel: {
    color: "#aaa",
    fontSize: PixelRatio.roundToNearestPixel(12),
    marginTop: PixelRatio.roundToNearestPixel(-4),
  },
});
