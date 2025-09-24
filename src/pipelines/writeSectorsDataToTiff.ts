import fs from "fs"
import path from "path"
import * as turf from "@turf/turf"
import gdal, { Point } from "gdal-async"
import type { Feature } from "geojson"
import { config } from "../config"
import { SectorData } from "../types/sectorData.type"
import { workingDirectories } from "../chores/directoriesManager"

const { TILES_OUTPUT_DIR } = workingDirectories

export const writeSectorsDataToTiff = async (sectorData: SectorData, paramsMaxCoeff: Record<string, number>) => {
    try {
        const { minX, minY, maxX, maxY, xSize, ySize, pixelSizeLon, pixelSizeLat } = sectorData.sizes
        const { tileName, paramsData } = sectorData

        const tiffPath = path.join(TILES_OUTPUT_DIR, `${tileName}.tif`)
        const driver = gdal.drivers.get("GTiff")

        const dataset = driver.create(tiffPath, xSize, ySize, 1, gdal.GDT_UInt16, [
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
        const data = new Uint8Array(xSize * ySize)

        const { gamma } = config.normalization

        for (let i = 0; i < xSize * ySize; i++) {
            let coefficient = Object.entries(paramsData).reduce((acc, [paramName, { paramData, weight }]) => {
                const paramValue = paramData[i]

                const paramMaxValue = paramsMaxCoeff[paramName]

                const val = (paramValue / paramMaxValue) * weight

                acc += val

                return acc
            }, 0)

            if (coefficient > 0) {
                // Применяем гамма-коррекцию для плавного затухания
                coefficient = Math.pow(coefficient, gamma)

                data[i] = Math.min(255, Math.round(coefficient * 255))
                pixelsAffected++
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
