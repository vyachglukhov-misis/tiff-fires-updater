import { toMercator } from "@turf/turf";
import fs from "fs";
import { Feature, Geometry, Point } from "geojson";
import path from "path";

export type FireObject = {
  geo: Feature<Point>;
  name: string;
  createdAt: string;
  id: string;
};

let firesCache: FireObject[] | null = null;

export const getFiresObjects = () => {
  if (firesCache) return firesCache;
  const firesObjects = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "fires.json"), "utf-8")
  );

  const fires: FireObject[] = firesObjects
    .filter(
      (obj: any) =>
        !obj.deleted &&
        obj.object.geo &&
        obj.object.geo.geometry &&
        obj.object.geo.geometry.type === "Point"
    )
    .map((obj: any) => ({
      geo: {
        type: "Feature",
        geometry: obj.object.geo.geometry,
        properties: {},
      },
      name: obj.name,
      createdAt: obj.created,
      id: obj._id,
    }));
  firesCache = fires;
  return fires;
};

export const getFiresObjectsProjected = () => {
  const fires = getFiresObjects();

  return fires.map((fire) => ({ ...fire, geo: toMercator(fire.geo) }));
};
