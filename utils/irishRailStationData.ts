export type TrainData = {
  ServerTime?: string;
  TrainCode: string;
  StationFullName: string;
  StationCode: string;
  QueryTime?: string;
  TrainDate: string;
  Origin: string;
  Destination: string;
  OriginTime: string;
  DestinationTime: string;
  Status: string;
  LastLocation: string;
  DueIn: string;
  Late: string;
  ExpArrival: string;
  ExpDepart: string;
  SchArrival: string;
  SchDepart: string;
  Direction: string;
  TrainType: string;
  LocationType: string;
};

const IRISH_RAIL_BASE =
  'http://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML_WithNumMins';

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getTagValue(fragment: string, tagVariants: string[]): string {
  for (const tag of tagVariants) {
    const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = fragment.match(re);
    if (match && match[1] != null) {
      return decodeXmlEntities(match[1].trim());
    }
  }
  return '';
}

function parseTrainsFromXml(xml: string): TrainData[] {
  const items = xml.match(/<objStationData>[\s\S]*?<\/objStationData>/gi) || [];
  return items.map((frag) => {
    const v = (tags: string | string[]) =>
      getTagValue(frag, Array.isArray(tags) ? tags : [tags]);

    // Handle common casing variants from the feed
    const train: TrainData = {
      ServerTime: v(['Servertime', 'ServerTime']),
      TrainCode: v(['Traincode', 'TrainCode']),
      StationFullName: v(['Stationfullname', 'StationFullName']),
      StationCode: v(['Stationcode', 'StationCode']),
      QueryTime: v(['Querytime', 'QueryTime']),
      TrainDate: v(['Traindate', 'TrainDate']),
      Origin: v('Origin'),
      Destination: v('Destination'),
      OriginTime: v(['Origintime', 'OriginTime']),
      DestinationTime: v(['Destinationtime', 'DestinationTime']),
      Status: v('Status'),
      LastLocation: v(['Lastlocation', 'LastLocation']),
      DueIn: v(['Duein', 'DueIn']),
      Late: v('Late'),
      ExpArrival: v(['Exparrival', 'ExpArrival']),
      ExpDepart: v(['Expdepart', 'ExpDepart']),
      SchArrival: v(['Scharrival', 'SchArrival']),
      SchDepart: v(['Schdepart', 'SchDepart', 'schDepart']),
      Direction: v('Direction'),
      TrainType: v(['Traintype', 'TrainType']),
      LocationType: v(['Locationtype', 'LocationType']),
    };
    return train;
  });
}

/**
 * Fetch trains due to serve a station in the next X minutes (5-90).
 */
export async function getStationDataByCode(
  stationCode: string,
  numMins: number
): Promise<TrainData[]> {
  const mins = Math.max(5, Math.min(90, Math.floor(numMins || 5)));
  const url = `${IRISH_RAIL_BASE}?StationCode=${encodeURIComponent(
    stationCode
  )}&NumMins=${mins}`;

  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`IrishRail API error: ${res.status} ${res.statusText}`);
  }
  const xml = await res.text();

  // No trains scheduled or unexpected content => return empty list
  if (!xml || !/<objStationData>/i.test(xml)) {
    return [];
  }

  return parseTrainsFromXml(xml);
}
