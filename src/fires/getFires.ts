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

import proj4 from "proj4";
import * as turf from "@turf/turf";

export function getUTMProjection(lon: number, lat: number) {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const isNorth = lat >= 0;
  const epsg = (isNorth ? 32600 : 32700) + zone;
  return {
    epsg,
    proj: `+proj=utm +zone=${zone} ${
      isNorth ? "+north" : "+south"
    } +datum=WGS84 +units=m +no_defs`,
  };
}
export function reprojectGeoJSON<T extends turf.AllGeoJSON>(
  geojson: T,
  fromProj: string,
  toProj: string
): T {
  // создаём глубокую копию объекта, чтобы не портить исходный
  const clone = JSON.parse(JSON.stringify(geojson)) as T;

  turf.coordEach(clone, (coord) => {
    const [x, y] = proj4(fromProj, toProj, coord as [number, number]);
    coord[0] = x;
    coord[1] = y;
  });

  return clone;
}

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
