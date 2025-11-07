import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useState } from 'react';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';

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

export default function Home() {
  const options = Object.keys(DART_STATION_CODES)
    .sort((a, b) => a.localeCompare(b))
    .map((stationName, index) => ({
      id: String(index + 1),
      label: stationName,
    }));

  const [selectedOption, setSelectedOption] = useState('Select a station');
  const [isOpen, setIsOpen] = useState(false);
  const rotation = useSharedValue(0);
  const height = useSharedValue(0);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
    rotation.value = withTiming(isOpen ? 0 : 180, { duration: 300 });
    height.value = withTiming(isOpen ? 0 : Math.min(options.length * 50, 300), { duration: 300 });
  };

  const handleSelect = (option: string) => {
    setSelectedOption(option);
    toggleDropdown();
  };

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
      height: height.value,
      opacity: withTiming(isOpen ? 1 : 0, { duration: 300 }),
    };
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Home screen</Text>

      <View style={styles.dropdownWrapper}>
        {/* Dropdown Button */}
        <Animated.View style={[styles.dropdown, dropdownButtonStyle]}>
          <TouchableOpacity
            style={styles.dropdownTouchable}
            onPress={toggleDropdown}
          >
            <Text style={styles.dropdownText}>{selectedOption}</Text>
            <Animated.Text style={[styles.dropdownArrow, arrowStyle]}>▼</Animated.Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Animated Options List */}
        <Animated.View style={[styles.optionsContainer, dropdownStyle]}>
          <ScrollView nestedScrollEnabled={true}>
            {options.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.option}
                onPress={() => handleSelect(item.label)}
              >
                <Text style={styles.optionText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
  },
  button: {
    fontSize: 20,
    textDecorationLine: 'underline',
    color: '#fff',
  },
  dropdownWrapper: {
    width: '80%',
    marginVertical: 20,
  },
  dropdown: {
    backgroundColor: '#3a3f47',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4a5057',
  },
  dropdownTouchable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
  },
  dropdownText: {
    color: '#fff',
    fontSize: 16,
  },
  dropdownArrow: {
    color: '#fff',
    fontSize: 12,
  },
  optionsContainer: {
    backgroundColor: '#3a3f47',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: '#4a5057',
    overflow: 'hidden',
    maxHeight: 300,
  },
  option: {
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#4a5057',
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
});
