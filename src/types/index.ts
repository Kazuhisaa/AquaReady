export type TyphoonSignal =
  | 'Walang Bagyo'
  | 'Signal #1 (Malalakas na Hangin)'
  | 'Signal #2 (Mabagsik na Hangin)'
  | 'Signal #3 (Malakas na Bagyo)'
  | 'Signal #4 (Napakalakas na Bagyo)'
  | 'Signal #5 (Super Typhoon)';

export interface MigrationDestination {
  destinationBarangay: string;
  destinationCity: string;
  distanceKm: number;
  availableHousingSlots: number;
  costPerFamilyPhp: number;
  reason: string;
  capacityStatus: 'Maluwag (High Capacity)' | 'Sapat (Moderate)' | 'Mabilis Mapuno (Limited)';
}

export interface LocalityBaseline {
  population: number;
  povertyRate: number; // percentage (0-100)
  informalSettlerFamilies: number; // count
  baselineSeaLevelRiseCm: number; // cm
  sinkingRateMmPerYear: number; // mm/yr land subsidence
  mangroveCoverKm2: number;
  drainagePumpCapacity: number; // 0-100 % rating
  nearestSafeDestination: MigrationDestination;
  coordinates: [number, number]; // [lat, lng]
}

export interface Locality {
  id: string;
  name: string;
  province: string;
  tagline: string;
  description: string;
  baseline: LocalityBaseline;
}

export type SeaScenario = 'Mabagal (Low Rise)' | 'Katamtaman (Normal Rise)' | 'Malala (Worst-Case Rise)';

export interface ThreatInputs {
  year: number; // 2025 - 2050
  tempRiseC: number; // 0.0 to 4.0 °C (Temperature rise / heat index)
  waterFoodScarcity: number; // 0 to 100 % (Water & Food scarcity)
  highTideSeaRiseCm: number; // 0 to 150 cm (High tide & sea rise)
  typhoonSignal: TyphoonSignal; // Bagyo levels
  scenario: SeaScenario;
}

export interface SolutionLevers {
  inPlaceFloodHeatDefense: number; // 0 - 100 % (Tier 1: Panangga sa baha, bakawan, cooling hubs)
  structuralRetrofitWaterFood: number; // 0 - 100 % (Tier 2: Elevated housing, rain catchment, food cold storage)
  managedMigrationRouting: number; // 0 - 100 % (Tier 3: Paglipat gamit ang Migration Router)
}

export interface TrajectoryPoint {
  year: number;
  unmitigatedResilience: number;
  adaptedResilience: number;
  compoundRiskLevel: number;
}

export interface ProposedSolution {
  id: string;
  tier: 'Tier 1: Panangga sa Lugar (In-Place Defense)' | 'Tier 2: Pag-aangkop ng Bahay at Kabuhayan (Adapt)' | 'Tier 3: Ligtas na Paglipat (Migration Router)';
  title: string;
  simpleExplanation: string;
  triggeredBy: string; // Hal. 'Bagyo Signal 3', 'Extreme Heat +2.5°C', 'High Tide +60cm'
  costEstimateMPhp: number;
  resilienceBoost: number; // +% boost
  priority: 'Kritikal' | 'Mahalaga' | 'Rekomendado';
}

export interface SimulationResult {
  resilienceScore: number; // 0 - 100
  unmitigatedScore: number;
  statusText: 'LIGTAS (Protektado)' | 'Kailangang Bantayan' | 'Nanganganib Lumubog' | 'Lubhang Delikado';
  statusColor: string;
  peopleAtRisk: number;
  familiesToRelocate: number;
  estimatedDamagePhpB: number;
  subscores: {
    compoundThreat: number; // 0-100 (Heat + Water/Food + Tide + Typhoon)
    peopleExposure: number; // 0-100
    communityDefense: number; // 0-100
    migrationReadiness: number; // 0-100
  };
  trajectory: TrajectoryPoint[];
  solutions: ProposedSolution[];
  migrationRecommendation: MigrationDestination;
}
