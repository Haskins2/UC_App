/**
 * Firestore schema overview:
 * 
 * users (collection)
 *  ├── user123 (document)             ← represents one user
 *  │    └── gpsReadings (subcollection)
 *  │         ├── abc123 (document)   ← individual GPS reading
 *  │         │    ├── latitude
 *  │         │    ├── longitude
 *  │         │    ├── timestamp
 *  │         │    └── etc.
 *  ├── user456
 *  │    └── gpsReadings
 *  │         └── ...
 * 
 * This structure allows you to easily separate and query readings per user.
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, addDoc, serverTimestamp } = require('firebase/firestore');
require('dotenv').config();

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

async function testConnection() {
  try {
    console.log('Initializing Firebase...');
    const app = initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
    
    console.log('\nTesting Firestore connection...');
    const db = getFirestore(app);
    
    // Simple test read to verify connection
    const testCollection = collection(db, 'test');
    await getDocs(testCollection);
    console.log('✅ Firestore connection successful');
    
    // ------------------------------------------------------
    // USER-BASED STRUCTURE
    // ------------------------------------------------------
    // In a real app, this userId would come from authentication (Firebase Auth)
    // For now, we’ll hardcode a test user for demonstration.
    const userId = 'stephen_haskins';

    // Reference path: users/{userId}/gpsReadings
    // This points to a subcollection where we’ll store each GPS record
    const gpsReadingsRef = collection(db, `users/${userId}/gpsReadings`);
    
    // Fake GPS data (one reading)
    const gpsData = {
      latitude: 53.3498,   // Dublin coordinates
      longitude: -6.2603,
      accuracy: 10,
      timestamp: serverTimestamp(),  // server-side timestamp
      speed: 5.2,
      heading: 180
    };
    
    // Add this reading under the current user’s gpsReadings subcollection
    const docRef = await addDoc(gpsReadingsRef, gpsData);

    console.log(`✅ GPS data stored successfully for user "${userId}"`);
    console.log(`   Document ID: ${docRef.id}`);
    console.log('\n🎉 All Firebase services are working and data is structured correctly!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testConnection();
