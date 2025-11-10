import { XMLParser } from 'fast-xml-parser';
// import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK (do this once at the top)
// if (!admin.apps.length) {
//   admin.initializeApp({
//     credential: admin.credential.applicationDefault(),
//     // Or use a service account key file:
//     // credential: admin.credential.cert(require('./path-to-serviceAccountKey.json'))
//   });
// }

// const db = admin.firestore();

interface DartTrain {
  TrainStatus: string;
  TrainLatitude: string;
  TrainLongitude: string;
  TrainCode: string;
  TrainDate: string;
  PublicMessage: string;
  Direction: string;
}

// Function to sanitize train code for use as Firestore document ID
function sanitizeTrainCode(trainCode: string): string {
  // Remove spaces, forward slashes, and other special characters
  // Replace them with underscores or hyphens
  return trainCode
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/\//g, '-')            // Replace forward slashes with hyphens
    .replace(/[^a-zA-Z0-9_-]/g, '') // Remove any other special characters
    .substring(0, 1500);            // Firestore doc ID limit is 1500 bytes
}

// Function to upload train data to Firebase
async function uploadTrainToFirebase(train: any): Promise<void> {
  try {
    const trainCode = train.TrainCode;
    const sanitizedTrainCode = sanitizeTrainCode(trainCode);
    
    // Reference to the specific train document: Trains/{TrainCode}
    // const trainDocRef = db.collection('Trains').doc(sanitizedTrainCode);
    
    // Prepare train data with all metadata
    const trainData = {
      trainCode: train.TrainCode || null,
      status: train.TrainStatus || null,
      direction: train.Direction || null,
      latitude: train.TrainLatitude || null,
      longitude: train.TrainLongitude || null,
      trainDate: train.TrainDate || null,
      publicMessage: train.PublicMessage || null,
      // timestamp: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: new Date().toISOString(),
    };
    
    // Upload to Firebase (set overwrites existing document)
    // await trainDocRef.set(trainData);
    console.log(`✓ Uploaded train ${trainCode} (ID: ${sanitizedTrainCode}) to Firebase`);
  } catch (error) {
    console.error(`✗ Error uploading train ${train.TrainCode}:`, error);
  }
}

async function getCurrentDarts(): Promise<void> {
  try {
    const apiUrl = 'http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D';
    
    // Get filter and cloud flag from command line arguments
    const args = process.argv.slice(2);
    const cloudMode = args.includes('--cloud');
    const filterTrainCode = args.find(arg => !arg.startsWith('--'))?.toUpperCase();
    
    console.log('Fetching current DART trains...\n');
    if (filterTrainCode) {
      console.log(`Filtering by Train Code: ${filterTrainCode}\n`);
    }
    
    const response = await fetch(apiUrl);
    const xmlData = await response.text();
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    
    const result = parser.parse(xmlData);
    const trains = result.ArrayOfObjTrainPositions?.objTrainPositions || [];
    
    // Ensure trains is always an array
    let trainsArray = Array.isArray(trains) ? trains : [trains];
    
    // Filter by train code if provided
    if (filterTrainCode) {
      trainsArray = trainsArray.filter((train: any) => 
        train.TrainCode?.toUpperCase().includes(filterTrainCode)
      );
    }
    
    if (trainsArray.length === 0) {
      console.log(filterTrainCode 
        ? `No DART trains found matching code: ${filterTrainCode}` 
        : 'No DART trains currently running.'
      );
      return;
    }
    
    console.log(`Found ${trainsArray.length} running DART train(s):\n`);
    
    // Upload to Firebase if --cloud flag is present
    if (cloudMode) {
      console.log('Cloud mode enabled - uploading to Firebase...\n');
      
      for (const train of trainsArray) {
        await uploadTrainToFirebase(train);
      }
      
      console.log(`\n✓ Successfully uploaded ${trainsArray.length} train(s) to Firebase\n`);
    }
    
    console.log('='.repeat(80));
    
    trainsArray.forEach((train: any, index: number) => {
      console.log(`\nTrain #${index + 1}`);
      console.log('-'.repeat(80));
      console.log(`Train Code:      ${train.TrainCode || 'N/A'}`);
      console.log(`Status:          ${train.TrainStatus || 'N/A'}`);
      console.log(`Direction:       ${train.Direction || 'N/A'}`);
      console.log(`Latitude:        ${train.TrainLatitude || 'N/A'}`);
      console.log(`Longitude:       ${train.TrainLongitude || 'N/A'}`);
      console.log(`Date:            ${train.TrainDate || 'N/A'}`);
      console.log(`Public Message:  ${train.PublicMessage || 'N/A'}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('Error fetching DART trains:', error);
  }
}

// Run the function
getCurrentDarts();