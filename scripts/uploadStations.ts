import 'dotenv/config';

// Map FIREBASE_ env vars to EXPO_PUBLIC_FIREBASE_ if needed
const keys = [
  'API_KEY',
  'AUTH_DOMAIN',
  'PROJECT_ID',
  'STORAGE_BUCKET',
  'MESSAGING_SENDER_ID',
  'APP_ID',
  'MEASUREMENT_ID'
];

keys.forEach(key => {
  const firebaseKey = `FIREBASE_${key}`;
  const expoKey = `EXPO_PUBLIC_FIREBASE_${key}`;
  if (process.env[firebaseKey] && !process.env[expoKey]) {
    process.env[expoKey] = process.env[firebaseKey];
  }
});

import { getAllStations } from '../utils/IrishRailAPI/returnAllStations';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// console.log('Firebase Config:', JSON.stringify(firebaseConfig, null, 2));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function uploadStations() {
  console.log('Starting station upload...');
  
  if (!process.env.EXPO_PUBLIC_FIREBASE_API_KEY) {
    console.error('Error: EXPO_PUBLIC_FIREBASE_API_KEY is not set. Please check your .env file.');
    process.exit(1);
  } else {
    console.log('Firebase API Key is set.');
    console.log('Project ID:', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID);
  }

  try {
    const stations = await getAllStations();
    console.log(`Fetched ${stations.length} stations.`);

    if (stations.length === 0) {
      console.log('No stations found.');
      return;
    }

    for (const station of stations) {
      // Use StationDesc as the document ID
      // Sanitize to ensure valid document ID
      const docId = (station.StationDesc || 'unknown_station').replace(/\//g, '-');

      const stationRef = doc(db, 'trainStations', docId);
      
      // Ensure no undefined values and handle NaN
      const data = {
        stationName: station.StationDesc || null,
        stationCode: station.StationCode || null,
        stationId: station.StationId || null,
        latitude: (typeof station.StationLatitude === 'number' && !Number.isNaN(station.StationLatitude)) ? station.StationLatitude : null,
        longitude: (typeof station.StationLongitude === 'number' && !Number.isNaN(station.StationLongitude)) ? station.StationLongitude : null,
        lastUpdated: new Date().toISOString()
      };

      // console.log('Uploading data:', JSON.stringify(data, null, 2));

      await setDoc(stationRef, data, { merge: true });
      console.log(`Uploaded: ${station.StationDesc}`);
    }

    console.log('Upload complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error uploading stations:', error);
    process.exit(1);
  }
}

uploadStations();
