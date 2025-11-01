import { XMLParser } from 'fast-xml-parser';

export interface Station {
  StationDesc: string;
  StationCode: string;
  StationId: string;
  StationLatitude: number;
  StationLongitude: number;
}

let cachedStations: Station[] | null = null;

export async function getAllStations(): Promise<Station[]> {
  // Return cached data if available
  if (cachedStations) {
    return cachedStations;
  }

  try {
    const response = await fetch('http://api.irishrail.ie/realtime/realtime.asmx/getAllStationsXML_WithStationType?StationType=D');
    const xmlText = await response.text();
    
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
    });
    
    const result = parser.parse(xmlText);
    const stations = result.ArrayOfObjStation?.objStation || [];
    
    // Ensure stations is always an array (single station might not be in array)
    const stationsArray = Array.isArray(stations) ? stations : [stations];
    
    cachedStations = stationsArray.map((station: any) => ({
      StationDesc: station.StationDesc || '',
      StationCode: station.StationCode || '',
      StationId: station.StationId || '',
      StationLatitude: parseFloat(station.StationLatitude || '0'),
      StationLongitude: parseFloat(station.StationLongitude || '0'),
    }));
    
    return cachedStations;
  } catch (error) {
    throw new Error('Failed to fetch stations: ' + (error as Error).message);
  }
}
