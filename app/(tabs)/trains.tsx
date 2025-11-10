import { Text, View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { XMLParser } from 'fast-xml-parser';
import { db } from '../../config/firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

interface DartTrain {
  TrainCode: string;
  TrainStatus: string;
  TrainLatitude: string;
  TrainLongitude: string;
  TrainDate: string;
  PublicMessage: string;
  Direction: string;
}

export default function Trains() {
  const [trains, setTrains] = useState<DartTrain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLiveUploading, setIsLiveUploading] = useState(false);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Function to fetch DART trains from API
  const fetchDartTrains = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    
    try {
      const apiUrl = 'http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D';
      const response = await fetch(apiUrl);
      const xmlData = await response.text();
      
      // Parse XML using fast-xml-parser
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });
      
      const result = parser.parse(xmlData);
      const trains = result.ArrayOfObjTrainPositions?.objTrainPositions || [];
      
      // Ensure trains is always an array
      let trainsArray = Array.isArray(trains) ? trains : [trains];
      
      if (trainsArray.length === 0) {
        setErrorMsg('No DART trains currently running');
        setTrains([]);
        setIsLoading(false);
        return;
      }
      
      setTrains(trainsArray);
      
      setIsLoading(false);
    } catch (error) {
      setErrorMsg('Error fetching DART trains: ' + (error as Error).message);
      setIsLoading(false);
    }
  };

  // New function to fetch and then upload data, for live updates
  const fetchAndUploadTrains = async () => {
    try {
      const apiUrl = 'http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D';
      const response = await fetch(apiUrl);
      const xmlData = await response.text();
      
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '',
      });
      
      const result = parser.parse(xmlData);
      const fetchedTrains = result.ArrayOfObjTrainPositions?.objTrainPositions || [];
      let trainsArray = Array.isArray(fetchedTrains) ? fetchedTrains : [fetchedTrains];

      if (trainsArray.length > 0) {
        setTrains(trainsArray); // Update UI with latest data
        
        // Upload the fresh data to Firebase
        const trainDataRef = collection(db, 'trainData');
        const uploadPromises = trainsArray.map(train => {
          const trainDocRef = doc(trainDataRef, train.TrainCode);
          const trainData = {
            fetchTimestamp: serverTimestamp(),
            trainCode: train.TrainCode,
            trainStatus: train.TrainStatus,
            latitude: parseFloat(train.TrainLatitude),
            longitude: parseFloat(train.TrainLongitude),
            trainDate: train.TrainDate,
            publicMessage: train.PublicMessage,
            direction: train.Direction,
          };
          return setDoc(trainDocRef, trainData, { merge: true });
        });
        await Promise.all(uploadPromises);
        setErrorMsg(null); // Clear previous errors on success
      } else {
        setTrains([]);
      }
    } catch (error) {
      // Don't stop the interval, just log the error for this attempt
      setErrorMsg('Live update failed: ' + (error as Error).message);
    }
  };

  // Function to upload all fetched trains to Firebase
  const uploadToFirebase = async () => {
    if (trains.length === 0) {
      setErrorMsg('No train data to upload.');
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      // The data is universal, so store it in a root collection called 'trainData'
      const trainDataRef = collection(db, 'trainData');

      const uploadPromises = trains.map(train => {
        const trainDocRef = doc(trainDataRef, train.TrainCode);

        const trainData = {
          fetchTimestamp: serverTimestamp(),
          trainCode: train.TrainCode,
          trainStatus: train.TrainStatus,
          latitude: parseFloat(train.TrainLatitude),
          longitude: parseFloat(train.TrainLongitude),
          trainDate: train.TrainDate,
          publicMessage: train.PublicMessage,
          direction: train.Direction,
        };
        return setDoc(trainDocRef, trainData, { merge: true });
      });

      await Promise.all(uploadPromises);
      
    } catch (error) {
      setErrorMsg('Error uploading to Firebase: ' + (error as Error).message);
    } finally {
      setIsUploading(false);
    }
  };

  // Function to toggle live uploading
  const toggleLiveUploading = () => {
    if (isLiveUploading) {
      // Stop live uploading
      if (intervalId) {
        clearInterval(intervalId);
      }
      setIntervalId(null);
      setIsLiveUploading(false);
    } else {
      // Start live uploading
      setIsLiveUploading(true);
      setErrorMsg(null);
      // Fetch and upload immediately, then set interval
      fetchAndUploadTrains();
      const newIntervalId = setInterval(fetchAndUploadTrains, 10000); // 10 seconds
      setIntervalId(newIntervalId);
    }
  };

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.container}>
        <Text style={styles.title}>DART Trains</Text>
        <Text style={styles.counterText}>
          {trains.length > 0 ? `${trains.length} train(s) running` : 'No data collected'}
        </Text>

        <View style={styles.buttonContainer}>
          <Pressable 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={() => {
              fetchDartTrains();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Fetching...' : 'Fetch Running Trains'}
            </Text>
          </Pressable>

          {/* Upload to Firebase button */}
          <Pressable
            style={[
              styles.button,
              styles.uploadButton,
              (isUploading || trains.length === 0) && styles.buttonDisabled,
            ]}
            onPress={() => {
              uploadToFirebase();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            disabled={isUploading || trains.length === 0}
          >
            <Text style={styles.buttonText}>
              {isUploading ? 'Uploading...' : 'Upload to Firebase'}
            </Text>
          </Pressable>

          {/* Live Upload Toggle Button */}
          <Pressable
            style={[
              styles.button,
              isLiveUploading ? styles.liveSharingActive : styles.liveSharingButton,
            ]}
            onPress={() => {
              toggleLiveUploading();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Text style={styles.buttonText}>
              {isLiveUploading ? 'Stop Live Upload' : 'Start Live Upload'}
            </Text>
          </Pressable>
        </View>

        {isLoading && (
          <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
        )}

        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}
        
        {trains.length > 0 && (
          <View style={styles.trainsContainer}>
            {trains.map((train, index) => (
              <View key={`${train.TrainCode}-${index}`} style={styles.trainCard}>
                <Text style={styles.trainTitle}>Train #{index + 1}</Text>
                <View style={styles.trainDetails}>
                  <Text style={styles.trainLabel}>Train Code:</Text>
                  <Text style={styles.trainValue}>{train.TrainCode}</Text>
                </View>
                <View style={styles.trainDetails}>
                  <Text style={styles.trainLabel}>Status:</Text>
                  <Text style={styles.trainValue}>{train.TrainStatus}</Text>
                </View>
                <View style={styles.trainDetails}>
                  <Text style={styles.trainLabel}>Direction:</Text>
                  <Text style={styles.trainValue}>{train.Direction}</Text>
                </View>
                <View style={styles.trainDetails}>
                  <Text style={styles.trainLabel}>Location:</Text>
                  <Text style={styles.trainValue}>
                    {train.TrainLatitude}, {train.TrainLongitude}
                  </Text>
                </View>
                {train.PublicMessage !== 'N/A' && (
                  <View style={styles.trainDetails}>
                    <Text style={styles.trainLabel}>Message:</Text>
                    <Text style={styles.trainValue}>{train.PublicMessage}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    backgroundColor: '#25292e',
  },
  container: {
    flex: 1,
    backgroundColor: '#25292e',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  counterText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 8,
  },
  buttonDisabled: {
    backgroundColor: '#3A3A3C',
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  uploadButton: {
    backgroundColor: '#34C759', // Green color for upload
  },
  liveSharingButton: {
    backgroundColor: '#5856D6', // purple color
  },
  liveSharingActive: {
    backgroundColor: '#AF52DE', // brighter purple
  },
  loader: {
    marginTop: 30,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 20,
    textAlign: 'center',
  },
  trainsContainer: {
    marginTop: 30,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 15,
    paddingBottom: 30,
  },
  trainCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  trainTitle: {
    color: '#007AFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  trainDetails: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  trainLabel: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
    width: 90,
  },
  trainValue: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
});
