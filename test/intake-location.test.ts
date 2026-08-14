import { describe, expect, it } from "vitest";
import {
  clusterCentroid,
  clusterCoordinateIncidents,
  geojsonCentroid
} from "../src/intake-location";

describe("intake coordinate clustering", () => {
  it("groups nearby incidents of the same status and keeps distant or planned incidents separate", () => {
    const clustered = clusterCoordinateIncidents([
      { status: "unplanned", latitude: 46.99037, longitude: 7.7314 },
      { status: "unplanned", latitude: 46.9917, longitude: 7.72129 },
      { status: "unplanned", latitude: 46.72137, longitude: 7.56248 },
      { status: "planned", latitude: 46.9905, longitude: 7.731 }
    ]);

    expect(clustered).toHaveLength(3);
    const sizes = clustered.map((group) => group.length).sort((left, right) => right - left);
    expect(sizes).toEqual([2, 1, 1]);
  });

  it("uses the geographic mean as the cluster centroid", () => {
    expect(
      clusterCentroid([
        { latitude: 46.0, longitude: 7.0 },
        { latitude: 48.0, longitude: 9.0 }
      ])
    ).toEqual({ latitude: 47, longitude: 8 });
  });

  it("reads a GeoJSON point out of nested operator geometry", () => {
    expect(
      geojsonCentroid({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "GeometryCollection",
              geometries: [{ type: "Point", coordinates: [6.5271336, 46.6737207] }]
            }
          }
        ]
      })
    ).toEqual({ latitude: 46.6737207, longitude: 6.5271336 });
  });
});
