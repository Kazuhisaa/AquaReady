// Isabela LGUs — population: PSA 2020 Census (via PhilAtlas).
// Coordinates: town centers from Open-Meteo geocoding (GeoNames); San Pablo, San Agustin, Divilacan from Wikipedia.
// Coastal = faces the Philippine Sea → sea-level-rise / saltwater-intrusion pathway applies.

export interface IsabelaLgu {
  name: string;
  type: 'city' | 'municipality';
  population2020: number;
  coordinates: [number, number];
  coastal: boolean;
}

export const ISABELA_LGUS: IsabelaLgu[] = [
  { name: 'Alicia', type: 'municipality', population2020: 73874, coordinates: [16.7794, 121.6973], coastal: false },
  { name: 'Angadanan', type: 'municipality', population2020: 44977, coordinates: [16.7553, 121.7483], coastal: false },
  { name: 'Aurora', type: 'municipality', population2020: 36621, coordinates: [16.9906, 121.6366], coastal: false },
  { name: 'Benito Soliven', type: 'municipality', population2020: 29752, coordinates: [16.9815, 121.9599], coastal: false },
  { name: 'Burgos', type: 'municipality', population2020: 26040, coordinates: [17.0891, 121.7025], coastal: false },
  { name: 'Cabagan', type: 'municipality', population2020: 53897, coordinates: [17.4278, 121.7695], coastal: false },
  { name: 'Cabatuan', type: 'municipality', population2020: 39990, coordinates: [16.9566, 121.6685], coastal: false },
  { name: 'Cauayan', type: 'city', population2020: 143403, coordinates: [16.9347, 121.7725], coastal: false },
  { name: 'Cordon', type: 'municipality', population2020: 46477, coordinates: [16.6744, 121.4658], coastal: false },
  { name: 'Delfin Albano', type: 'municipality', population2020: 29928, coordinates: [17.3081, 121.7776], coastal: false },
  { name: 'Dinapigue', type: 'municipality', population2020: 5821, coordinates: [16.5273, 122.2645], coastal: true },
  { name: 'Divilacan', type: 'municipality', population2020: 5827, coordinates: [17.33, 122.3], coastal: true },
  { name: 'Echague', type: 'municipality', population2020: 88410, coordinates: [16.7051, 121.6763], coastal: false },
  { name: 'Gamu', type: 'municipality', population2020: 30655, coordinates: [17.0497, 121.836], coastal: false },
  { name: 'Ilagan', type: 'city', population2020: 158218, coordinates: [17.1485, 121.8892], coastal: false },
  { name: 'Jones', type: 'municipality', population2020: 45628, coordinates: [16.5571, 121.7029], coastal: false },
  { name: 'Luna', type: 'municipality', population2020: 20697, coordinates: [16.9698, 121.7292], coastal: false },
  { name: 'Maconacon', type: 'municipality', population2020: 3977, coordinates: [17.3875, 122.2416], coastal: true },
  { name: 'Mallig', type: 'municipality', population2020: 32208, coordinates: [17.2128, 121.6107], coastal: false },
  { name: 'Naguilian', type: 'municipality', population2020: 33788, coordinates: [17.0232, 121.837], coastal: false },
  { name: 'Palanan', type: 'municipality', population2020: 17684, coordinates: [17.0606, 122.43], coastal: true },
  { name: 'Quezon', type: 'municipality', population2020: 27037, coordinates: [17.313, 121.6065], coastal: false },
  { name: 'Quirino', type: 'municipality', population2020: 25023, coordinates: [17.1333, 121.7], coastal: false },
  { name: 'Ramon', type: 'municipality', population2020: 56523, coordinates: [16.7842, 121.535], coastal: false },
  { name: 'Reina Mercedes', type: 'municipality', population2020: 27900, coordinates: [16.9855, 121.8266], coastal: false },
  { name: 'Roxas', type: 'municipality', population2020: 65839, coordinates: [17.1189, 121.6201], coastal: false },
  { name: 'San Agustin', type: 'municipality', population2020: 22096, coordinates: [16.52, 121.75], coastal: false },
  { name: 'San Guillermo', type: 'municipality', population2020: 20915, coordinates: [16.7254, 121.8098], coastal: false },
  { name: 'San Isidro', type: 'municipality', population2020: 27044, coordinates: [16.7333, 121.6167], coastal: false },
  { name: 'San Manuel', type: 'municipality', population2020: 34085, coordinates: [17.0237, 121.6357], coastal: false },
  { name: 'San Mariano', type: 'municipality', population2020: 60124, coordinates: [16.9826, 122.014], coastal: false },
  { name: 'San Mateo', type: 'municipality', population2020: 66663, coordinates: [16.8821, 121.5869], coastal: false },
  { name: 'San Pablo', type: 'municipality', population2020: 26320, coordinates: [17.4478, 121.795], coastal: false },
  { name: 'Santa Maria', type: 'municipality', population2020: 25758, coordinates: [17.4664, 121.7522], coastal: false },
  { name: 'Santiago', type: 'city', population2020: 148580, coordinates: [16.6881, 121.5487], coastal: false },
  { name: 'Santo Tomas', type: 'municipality', population2020: 24528, coordinates: [17.3997, 121.7645], coastal: false },
  { name: 'Tumauini', type: 'municipality', population2020: 70743, coordinates: [17.2766, 121.8085], coastal: false },
];

