import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import { toMercator } from "@turf/projection";
import gdal from "gdal-async";
import type { Feature } from "geojson";

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
  const data = Buffer.alloc(xSize * ySize);
  for (let y = 0; y < ySize; y++) {
    for (let x = 0; x < xSize; x++) {
      // Центр пикселя
      try {
        const px = minX + x * pixelSize + pixelSize / 2;
        const py = maxY - y * pixelSize - pixelSize / 2;

        const point = new gdal.Point(px, py);
        const inside = tileGeom.contains(point);

        data[y * xSize + x] = inside ? Math.floor(Math.random() * 256) : 0;
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }
    if (Math.round((y / ySize) * 100) % 5 === 0) {
      const progress = Math.round(((y + 1) / ySize) * 100);
      process.send?.({ tileName, progress, status: "progress" });
    }
  }

  band.pixels.write(0, 0, xSize, ySize, data);

  dataset.flush();
  dataset.close();

  return { ok: true, message: { tileName, xSize, ySize, status: "created" } };
};
