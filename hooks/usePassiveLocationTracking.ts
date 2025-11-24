import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// const USER_ID = 'stephen_haskins'; // Hardcoded for nowr
const USER_ID = 'keela_e_duffy';

export function usePassiveLocationTracking() {
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let isMounted = true;

    const startTracking = async () => {
      console.log('Starting passive location tracking...');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        console.log('Location permission status:', status);
        
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          return;
        }

        if (!isMounted) return;

        locationSubscription.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000, // Update every 5 seconds
            distanceInterval: 0, // Update regardless of distance
          },
          async (location) => {
            try {
              console.log('Passive location update received:', location.coords.latitude, location.coords.longitude);
              const latestReadingRef = doc(db, 'users', USER_ID, 'gpsReadings', 'latest');
              
              const gpsData = {
                timestamp: serverTimestamp(),
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                altitude: location.coords.altitude ?? null,
                horizontalAccuracy: location.coords.accuracy ?? null,
                altitudeAccuracy: location.coords.altitudeAccuracy ?? null,
                speed: location.coords.speed ?? null,
                heading: location.coords.heading ?? null,
              };

              await setDoc(latestReadingRef, gpsData);
              console.log('Passive location successfully uploaded to Firebase');
            } catch (error) {
              console.error('Error updating passive location:', error);
            }
          }
        );
      } catch (error) {
        console.error('Error starting passive location tracking:', error);
      }
    };

    startTracking();

    return () => {
      isMounted = false;
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
  }, []);
}
