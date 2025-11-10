import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

export default function Trains() {
  // get params if directed via timetable
  const { destination, trainCode } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        Train to: {destination}, {trainCode}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#25292e",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: "#fff",
  },
});
