// 4. Get Current Trains with Type usage http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D returns a listing of 'running trains' ie trains that are between origin and destination or are due to start within 10 minutes of the query time. Returns TrainStatus, TrainLatitude, TrainLongitude, TrainCode, TrainDate, PublicMessage and Direction filtered by traintype,  takes a single letter with 4 possible values for the StationType parameter (A for All, M for Mainline, S for suburban and D for DART) any other value will be changed to A

const xml2js = require('xml2js');

const API_URL = 'http://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML_WithTrainType?TrainType=D';

async function fetchDartLocations() {
  const response = await fetch(API_URL);
  const xmlText = await response.text();
  
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlText);
  
  const trains = result.ArrayOfObjTrainPositions.objTrainPositions || [];
  
  return trains.map(train => ({
    TrainCode: train.TrainCode[0],
    TrainLatitude: train.TrainLatitude[0],
    TrainLongitude: train.TrainLongitude[0]
  }));
}

describe('DART Location API Tests', () => {
  test('should fetch DART train locations', async () => {
    const dartLocations = await fetchDartLocations();
    
    console.log('DART Locations:', JSON.stringify(dartLocations, null, 2));
    
    expect(Array.isArray(dartLocations)).toBe(true);
  });

  test('should return only TrainCode, TrainLatitude, and TrainLongitude', async () => {
    const dartLocations = await fetchDartLocations();
    
    if (dartLocations.length > 0) {
      const firstTrain = dartLocations[0];
      expect(firstTrain).toHaveProperty('TrainCode');
      expect(firstTrain).toHaveProperty('TrainLatitude');
      expect(firstTrain).toHaveProperty('TrainLongitude');
      expect(Object.keys(firstTrain).length).toBe(3);
    }
  });
});

