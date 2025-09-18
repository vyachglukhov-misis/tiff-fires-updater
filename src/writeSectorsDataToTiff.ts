import fs from "fs";
import path from "path";
import * as turf from "@turf/turf";
import { toMercator } from "@turf/projection";
import gdal, { Point } from "gdal-async";
import type { Feature } from "geojson";
import { config } from "./config";
import { SectorData } from "./types/sectorData";

const OUT_DIR = path.join(__dirname, "tiles");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

export const writeSectorsDataToTiff = async (
  sectorData: SectorData,
  maxCoefficient: number
) => {
  try {
    const { minX, minY, maxX, maxY } = sectorData.sizes;
    const { tileName } = sectorData;
    const { pixelsData } = sectorData;

    const pixelSize = config.pixelSize;
    const xSize = Math.ceil((maxX - minX) / pixelSize);
    const ySize = Math.ceil((maxY - minY) / pixelSize);

    const tiffPath = path.join(OUT_DIR, `${tileName}.tif`);
    const driver = gdal.drivers.get("GTiff");

    const dataset = driver.create(tiffPath, xSize, ySize, 1, gdal.GDT_Byte, [
      "TILED=YES",
      "COMPRESS=DEFLATE",
      "BIGTIFF=IF_SAFER",
    ]);
    const srs = gdal.SpatialReference.fromEPSG(3857);
    dataset.srs = srs;
    // Устанавливаем геопривязку (GeoTransform)
    dataset.geoTransform = [minX, pixelSize, 0, maxY, 0, -pixelSize];

    const band = dataset.bands.get(1);

    let pixelsAffected = 0;
    // Нормализация и запись в Uint8Array
    const data = new Uint8Array(xSize * ySize);
    for (let i = 0; i < xSize * ySize; i++) {
      if (maxCoefficient) {
        data[i] = Math.round((pixelsData[i] / maxCoefficient) * 255);
        pixelsAffected++;
      } else {
        data[i] = 0;
      }
    }

    band.pixels.write(0, 0, xSize, ySize, data);

    dataset.flush();
    dataset.close();

    return {
      ok: true,
      message: {
        tileName,
        totalPixels: ySize * xSize,
        pixelsAffected,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
};
