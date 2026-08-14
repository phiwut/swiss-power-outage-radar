import { reverseGeocodeSwissMunicipality } from "./geo";

export const INTAKE_CLUSTER_METERS = 2500;

export interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

export interface CoordinateIncident extends CoordinatePoint {
  status: string;
}

export interface LocatedIncidentCluster<T extends CoordinateIncident> {
  status: T["status"];
  location: string | null;
  latitude: number;
  longitude: number;
  items: T[];
}

function compact(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function earthDistanceMeters(left: CoordinatePoint, right: CoordinatePoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRad(right.latitude - left.latitude);
  const deltaLon = toRad(right.longitude - left.longitude);
  const lat1 = toRad(left.latitude);
  const lat2 = toRad(right.latitude);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function clusterCentroid(items: CoordinatePoint[]): CoordinatePoint {
  const count = items.length || 1;
  return {
    latitude: items.reduce((sum, item) => sum + item.latitude, 0) / count,
    longitude: items.reduce((sum, item) => sum + item.longitude, 0) / count
  };
}

export function clusterCoordinateIncidents<T extends CoordinateIncident>(
  items: T[],
  maxDistanceMeters = INTAKE_CLUSTER_METERS
): T[][] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left: number, right: number) => {
    const rootLeft = find(left);
    const rootRight = find(right);
    if (rootLeft !== rootRight) parent[rootRight] = rootLeft;
  };

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      if (items[i].status !== items[j].status) continue;
      if (earthDistanceMeters(items[i], items[j]) <= maxDistanceMeters) union(i, j);
    }
  }

  const groups = new Map<number, T[]>();
  items.forEach((item, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(item);
    groups.set(root, group);
  });
  return [...groups.values()];
}

function collectPositions(value: unknown, positions: CoordinatePoint[]): void {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.coordinates) && typeof record.coordinates[0] === "number") {
    const longitude = Number(record.coordinates[0]);
    const latitude = Number(record.coordinates[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      positions.push({ latitude, longitude });
    }
    return;
  }
  if (record.type === "Feature") {
    collectPositions(record.geometry, positions);
    return;
  }
  if (record.type === "FeatureCollection" && Array.isArray(record.features)) {
    for (const feature of record.features) collectPositions(feature, positions);
    return;
  }
  if (record.type === "GeometryCollection" && Array.isArray(record.geometries)) {
    for (const geometry of record.geometries) collectPositions(geometry, positions);
    return;
  }
  if (Array.isArray(record.coordinates)) {
    for (const child of record.coordinates) collectPositions({ coordinates: child }, positions);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) collectPositions(child, positions);
  }
}

export function geojsonCentroid(geojson: unknown): CoordinatePoint | null {
  const positions: CoordinatePoint[] = [];
  collectPositions(geojson, positions);
  return positions.length > 0 ? clusterCentroid(positions) : null;
}

export async function resolveIncidentLocation(input: {
  namedLocation?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<string | null> {
  const named = compact(input.namedLocation);
  if (named) return named;
  if (typeof input.latitude !== "number" || typeof input.longitude !== "number") return null;
  const geo = await reverseGeocodeSwissMunicipality(input.latitude, input.longitude);
  return geo?.municipality ?? null;
}

export async function locateIncidentClusters<T extends CoordinateIncident>(
  items: T[]
): Promise<LocatedIncidentCluster<T>[]> {
  const located = await Promise.all(
    clusterCoordinateIncidents(items).map(async (itemsInCluster) => {
      const centroid = clusterCentroid(itemsInCluster);
      const location = await resolveIncidentLocation(centroid);
      return {
        status: itemsInCluster[0].status,
        location,
        latitude: centroid.latitude,
        longitude: centroid.longitude,
        items: itemsInCluster
      };
    })
  );

  const merged: LocatedIncidentCluster<T>[] = [];
  for (const cluster of located) {
    const existing = merged.find(
      (candidate) => candidate.status === cluster.status && candidate.location === cluster.location && cluster.location !== null
    );
    if (existing) {
      existing.items.push(...cluster.items);
      const centroid = clusterCentroid(existing.items);
      existing.latitude = centroid.latitude;
      existing.longitude = centroid.longitude;
      continue;
    }
    merged.push(cluster);
  }
  return merged;
}
