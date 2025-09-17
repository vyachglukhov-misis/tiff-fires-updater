import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import { toMercator } from "@turf/projection";
import gdal, { Point } from "gdal-async";
import type { Feature } from "geojson";
import {
  getFiresObjects,
  getFiresObjectsMercatorProjected,
} from "./fires/getFires";
import { config } from "./config";

const OUT_DIR = path.join(__dirname, "tiles");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

export const writeToTileFeature = async (
  feature: Feature,
  tileName: string
) => {
  // Преобразуем feature в метры (Web Mercator)
  const projected = toMercator(feature);
  const tileGeom = gdal.Geometry.fromGeoJson(projected.geometry);

  const [minX, minY, maxX, maxY] = turf.bbox(projected);

  const pixelSize = 90;
  const xSize = Math.ceil((maxX - minX) / pixelSize);
  const ySize = Math.ceil((maxY - minY) / pixelSize);

  if (xSize === 0 || ySize === 0) {
    return {
      ok: false,
      error: "🟡 Пропущен тайл: размер по X или Y равен 0",
    };
  }

  const tiffPath = path.join(OUT_DIR, `${tileName}.tif`);
  const driver = gdal.drivers.get("GTiff");

  const dataset = driver.create(tiffPath, xSize, ySize, 1, gdal.GDT_Byte, [
    "TILED=YES",
    "COMPRESS=DEFLATE",
    "BIGTIFF=IF_SAFER",
  ]);
  // Устанавливаем геопривязку (GeoTransform)
  dataset.geoTransform = [minX, pixelSize, 0, maxY, 0, -pixelSize];

  const band = dataset.bands.get(1);

  const data = Buffer.alloc(xSize * ySize, 0);
  const tempData = new Float32Array(xSize * ySize).fill(0);

  const firesObject = getFiresObjectsMercatorProjected();
  const firesGeoms = firesObject
    .filter((fire) => fire.geo)
    .map((fire) => gdal.Geometry.fromGeoJson(fire.geo.geometry));

  const MAX_DIST = config.reliableDistance;
  const MAX_DIST_SQ = MAX_DIST * MAX_DIST;

  // Предварительно создаём массив координат точечных пожаров
  const firesCoords: { x: number; y: number }[] = firesGeoms
    .filter((g) => g.wkbType === gdal.wkbPoint) // фильтруем только точки
    .map((g) => g as gdal.Point) // приводим к Point
    .map((point) => ({ x: point.x, y: point.y }));

  let max_fires_sum_rate = 0;

  for (let y = 0; y < ySize; y++) {
    for (let x = 0; x < xSize; x++) {
      const px = minX + x * pixelSize + pixelSize / 2;
      const py = maxY - y * pixelSize - pixelSize / 2;

      if (!tileGeom.contains(new gdal.Point(px, py))) {
        continue;
      }

      let current_pixel_coeff = 0;

      for (const point of firesCoords) {
        const dx = point.x - px;
        const dy = point.y - py;
        // if (dx * dx + dy * dy > MAX_DIST_SQ) {
        //   data[y * xSize + x] = 0;
        //   continue;
        // }

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MAX_DIST) current_pixel_coeff += config.expFunction(dist);
      }

      tempData[y * xSize + x] = current_pixel_coeff;

      if (current_pixel_coeff > max_fires_sum_rate) {
        max_fires_sum_rate = current_pixel_coeff;
      }
    }
    const progress = Math.floor((y / ySize) * 100);
    if (progress % 5 === 0 && progress !== 100) {
      process.send?.({
        tileName,
        progress,
        status: "progress",
      });
    }
  }
  for (let y = 0; y < ySize; y++) {
    for (let x = 0; x < xSize; x++) {
      const px = minX + x * pixelSize + pixelSize / 2;
      const py = maxY - y * pixelSize - pixelSize / 2;

      if (!tileGeom.contains(new gdal.Point(px, py))) {
        data[y * xSize + x] = 1;
        continue;
      }
      if (max_fires_sum_rate) {
        data[y * xSize + x] = Math.floor(
          (tempData[y * xSize + x] / max_fires_sum_rate) * 255
        );
      } else {
        data[y * xSize + x] = 1;
      }
    }
  }

  band.pixels.write(0, 0, xSize, ySize, data);

  dataset.flush();
  dataset.close();

  process.send?.({
    tileName,
    size: ySize * xSize,
    contentExists: max_fires_sum_rate,
    progress: 100,
    status: "created",
  });
};
