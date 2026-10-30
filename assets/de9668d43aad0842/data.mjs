export const VERSION = "0.4.0";
export const SOURCES = [
  {
    title: "ERA — Braking curves",
    url: "https://www.era.europa.eu/domains/european-rail-traffic-management-system/braking-curves",
    note: "Public primary guidance. ETCS brake curves combine train braking dynamics and track characteristics. This app does not implement the ETCS supervision algorithm.",
  },
  {
    title: "ERA — Introduction to ETCS braking curves",
    url: "https://www.era.europa.eu/system/files/2022-11/Introduction%20to%20ETCS%20braking%20curves.pdf",
    note: "Public technical reference for build-up, speed-dependent brake performance, gradient and correction-factor distinctions. No ETCS compliance is claimed.",
  },
];
export const VEHICLES = [
  {
    id: "synthetic-metro",
    name: "Metro · 4-car reference",
    status: "Synthetic — demonstration only",
    evidence:
      "Invented parameter set for software demonstration. Not a real fleet specification.",
    massT: 160,
    lengthM: 80,
    maxSpeedKph: 100,
    tractionA: 0.9,
    brakeA: 0.9,
    serviceA: 0.65,
    brakeCurve: [],
    tractionCurve: [],
  },
  {
    id: "synthetic-regional",
    name: "Regional · 3-car reference",
    status: "Synthetic — demonstration only",
    evidence: "Invented parameter set. No manufacturer braking guarantee.",
    massT: 180,
    lengthM: 75,
    maxSpeedKph: 160,
    tractionA: 0.6,
    brakeA: 0.75,
    serviceA: 0.5,
    brakeCurve: [],
    tractionCurve: [],
  },
  {
    id: "synthetic-lrv",
    name: "Light rail · 2-unit reference",
    status: "Synthetic — demonstration only",
    evidence:
      "Invented parameter set. Track brakes are not modeled separately.",
    massT: 90,
    lengthM: 60,
    maxSpeedKph: 80,
    tractionA: 1.1,
    brakeA: 1.05,
    serviceA: 0.75,
    brakeCurve: [],
    tractionCurve: [],
  },
];
export const DEFAULT = {
  schemaVersion: 1,
  name: "Reference corridor",
  revision: "P01",
  author: "",
  basis: "Synthetic demonstration — replace and review all inputs",
  vehicle: structuredClone(VEHICLES[0]),
  alignment: [
    { fromM: 0, toM: 2000, gradientPermille: 0, speedKph: 80 },
    { fromM: 2000, toM: 4000, gradientPermille: -18, speedKph: 90 },
    { fromM: 4000, toM: 6500, gradientPermille: 12, speedKph: 90 },
    { fromM: 6500, toM: 9000, gradientPermille: -25, speedKph: 80 },
    { fromM: 9000, toM: 14000, gradientPermille: 0, speedKph: 80 },
  ],
  scenario: {
    direction: 1,
    reactionS: 1,
    tractionDisableS: 0.8,
    brakeDelayS: 0.8,
    buildUpS: 1.2,
    overspeedKph: 3,
    speedErrorKph: 1,
    frontErrorM: 3,
    rearErrorM: 3,
    rollbackM: 0,
    extraM: 0,
    roundM: 5,
    obstacleM: null,
    dtS: 0.08,
    toleranceM: 0.05,
    maxTimeS: 600,
    method: "trajectory",
    constantGradePermille: 0,
  },
  study: { fromM: 1000, toM: 9000, spacingM: 500, speedsKph: [20, 40, 60, 80] },
};
export const ALIGNMENT_HEADERS = [
  "from_m",
  "to_m",
  "gradient_permille",
  "speed_kph",
];
export const ALIGNMENT_EXAMPLE =
  "from_m,to_m,gradient_permille,speed_kph\n0,2000,0,80\n2000,4000,-18,90\n4000,6500,12,90\n6500,9000,-25,80\n9000,14000,0,80\n";
