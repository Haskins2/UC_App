import { Text, View, StyleSheet, ScrollView } from 'react-native';
import { useState } from 'react';

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
  const [dartPosition, setDartPosition] = useState(6.5); // Position between stations (0-31)

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {stations.map((station, index) => (
          <View key={index} style={styles.stationContainer}>
            {/* Connecting line above station (except for first) */}
            {index > 0 && (
              <View style={styles.lineContainer}>
                <View style={styles.line} />
              </View>
            )}
            
            {/* Station marker on the line */}
            <View style={styles.stationWrapper}>
              <View style={styles.line} />
              <View style={styles.stationMarker} />
              <Text style={styles.stationText}>{station}</Text>
            </View>
            
            {/* Connecting line below station (except for last) */}
            {index < stations.length - 1 && (
              <View style={styles.lineContainer}>
                <View style={styles.line} />
                {/* Dart positioned on the line */}
                {dartPosition === index + 0.5 && (
                  <View style={styles.dartContainer}>
                    <View style={styles.dartBox} />
                    <View style={styles.dartBox} />
                    <View style={styles.dartBox} />
                  </View>
                )}
              </View>
            )}
          </View>
        ))}
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
  },
  stationContainer: {
    alignItems: 'center',
  },
  stationWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  lineContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  line: {
    width: 4,
    height: 40,
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
    left: 30,
  },
  dartContainer: {
    position: 'absolute',
    flexDirection: 'column', // Changed from 'row' to 'column'
    top: '50%',
    transform: [{ translateY: -14 }], // Center vertically (half of total height ~28px)
    zIndex: 2,
    left: -3, // Align with the line
  },
  dartBox: {
    width: 10,
    height: 15, // Adjusted height
    backgroundColor: '#46d213ff',
    borderRadius: 1,
    marginVertical: 1, // Changed from marginHorizontal to marginVertical
  }

});
