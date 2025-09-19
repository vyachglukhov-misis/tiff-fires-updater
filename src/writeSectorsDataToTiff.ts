import fs from "fs"
import path from "path"
import * as turf from "@turf/turf"
import gdal, { Point } from "gdal-async"
import type { Feature } from "geojson"
import { config } from "./config"
import { SectorData } from "./types/sectorData"

const OUT_DIR = path.join(__dirname, "tiles")
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR)

export const writeSectorsDataToTiff = async (sectorData: SectorData, maxCoefficient: number) => {
    try {
        const { minX, minY, maxX, maxY, xSize, ySize, pixelSizeLon, pixelSizeLat } = sectorData.sizes
        const { tileName, pixelsData } = sectorData

        const tiffPath = path.join(OUT_DIR, `${tileName}.tif`)
        const driver = gdal.drivers.get("GTiff")

        const dataset = driver.create(tiffPath, xSize, ySize, 1, gdal.GDT_Byte, [
            "TILED=YES",
            "COMPRESS=DEFLATE",
            "BIGTIFF=IF_SAFER",
        ])

        // Проекция WGS84
        const srs = gdal.SpatialReference.fromEPSG(4326)
        dataset.srs = srs

        // Геопривязка в градусах
        dataset.geoTransform = [
            minX, // top-left x (min longitude)
            pixelSizeLon, // pixel width (по долготе)
            0,
            maxY, // top-left y (max latitude)
            0,
            -pixelSizeLat, // pixel height (отрицательное, так как ось Y вниз)
        ]

        const band = dataset.bands.get(1)

        let pixelsAffected = 0
        const data = new Uint32Array(xSize * ySize)

        for (let i = 0; i < xSize * ySize; i++) {
            if (maxCoefficient) {
                data[i] = Math.round((pixelsData[i] / maxCoefficient) * 255)

                pixelsAffected++
            } else {
                data[i] = 0
            }
        }

        band.pixels.write(0, 0, xSize, ySize, data)

        dataset.flush()
        dataset.close()

        return {
            ok: true,
            message: {
                tileName,
                totalPixels: ySize * xSize,
                pixelsAffected,
            },
        }
    } catch (e) {
        console.error(e)
        return { ok: false, error: (e as Error).message }
    }
}
