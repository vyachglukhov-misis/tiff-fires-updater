import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import { toMercator } from "@turf/projection";
import gdal, { Point } from "gdal-async";
import type { Feature } from "geojson";
import { getFiresObjects, getFiresObjectsProjected } from "./fires/getFires";
import { config } from "./config";

import rbush from "rbush";

type FirePoint = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  x: number;
  y: number;
};

const OUT_DIR = path.join(__dirname, "tiles");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

export const getTileData = async (feature: Feature, tileName: string) => {
  // Преобразуем feature в метры (Web Mercator)
  const projected = toMercator(feature);
  const tileGeom = gdal.Geometry.fromGeoJson(projected.geometry);

  const [minX, minY, maxX, maxY] = turf.bbox(projected);

  const pixelSize = config.pixelSize;
  const xSize = Math.ceil((maxX - minX) / pixelSize);
  const ySize = Math.ceil((maxY - minY) / pixelSize);

  const tempData = new Float32Array(xSize * ySize).fill(0);

  const firesObject = getFiresObjectsProjected();

  const firesGeoms = firesObject
    .filter((fire) => fire.geo)
    .map((fire) => gdal.Geometry.fromGeoJson(fire.geo.geometry));

  const MAX_DIST = config.reliableDistance;
  const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

  const firesPoints: FirePoint[] = firesGeoms
    .filter((g) => g.name === "POINT")
    .map((g) => g as gdal.Point)
    .map((point) => ({
      minX: point.x,
      minY: point.y,
      maxX: point.x,
      maxY: point.y,
      x: point.x,
      y: point.y,
    }));

  // Создаём индекс
  const fireIndex = new rbush<FirePoint>();
  fireIndex.load(firesPoints);

  let max_fires_sum_rate = 0;
  for (let y = 0; y < ySize; y++) {
    const py = maxY - y * pixelSize - pixelSize / 2;
    for (let x = 0; x < xSize; x++) {
      const px = minX + x * pixelSize + pixelSize / 2;

      if (!tileGeom.contains(new gdal.Point(px, py))) {
        continue;
      }

      const nearbyFires = fireIndex.search({
        minX: px - MAX_DIST,
        minY: py - MAX_DIST,
        maxX: px + MAX_DIST,
        maxY: py + MAX_DIST,
      });

      let coeff = 0;
      for (const fire of nearbyFires) {
        const dx = fire.x - px;
        const dy = fire.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq <= MAX_DIST_SQ) {
          coeff += config.expFunction(Math.sqrt(distSq));
        }
      }

      tempData[y * xSize + x] = coeff;
      if (coeff > max_fires_sum_rate) max_fires_sum_rate = coeff;
    }
  }

  return {
    tileName,
    pixelsData: tempData,
    maxCoefficient: max_fires_sum_rate,
    sizes: {
      xSize,
      ySize,
      minX,
      minY,
      maxX,
      maxY,
      pixelSize,
    },
  };
};
