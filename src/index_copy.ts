import fs from "fs"
import path from "path"
import * as turf from "@turf/turf"
import { toMercator } from "@turf/projection"
import gdal from "gdal-async"
import type { Feature } from "geojson"


const OUT_DIR = path.join('/home/dev/Рабочий стол/fires-updater/src', "/tiles")
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR)

/**
 * Записывает геометрию feature в TIFF-файл, пикселями 90x90 м
 * @param feature GeoJSON Feature в WGS84
 * @param tileName Название выходного файла без расширения
 */
export const writeToTileFeature = async (feature: Feature, tileName: string) => {
    // Преобразуем feature в метры (Web Mercator)
    const projected = toMercator(feature)
    const tileGeom = gdal.Geometry.fromGeoJson(projected.geometry)

    const [minX, minY, maxX, maxY] = turf.bbox(projected)

    const pixelSize = 90
    const xSize = Math.ceil((maxX - minX) / pixelSize)
    const ySize = Math.ceil((maxY - minY) / pixelSize)

    if (xSize === 0 || ySize === 0) {
        console.warn("🟡 Пропущен тайл: размер по X или Y равен 0")
        return
    }

    const tiffPath = path.join(OUT_DIR, `${tileName}.tif`)
    const driver = gdal.drivers.get("GTiff")

    const dataset = driver.create(tiffPath, xSize, ySize, 1, gdal.GDT_Byte, [
        "TILED=YES",
        "COMPRESS=DEFLATE",
        "BIGTIFF=IF_SAFER"
    ])

    // Устанавливаем геопривязку (GeoTransform)
    dataset.geoTransform = [minX, pixelSize, 0, maxY, 0, -pixelSize]

    const band = dataset.bands.get(1)
    const data = Buffer.alloc(xSize * ySize)

    for (let y = 0; y < ySize; y++) {
        for (let x = 0; x < xSize; x++) {
            // Центр пикселя
            const px = minX + x * pixelSize + pixelSize / 2
            const py = maxY - y * pixelSize - pixelSize / 2

            const point = new gdal.Point(px, py)
            const inside = tileGeom.contains(point)

            data[y * xSize + x] = inside ? Math.floor(Math.random() * 256) : 0
        }

    }

    band.pixels.write(0, 0, xSize, ySize, data)

    dataset.flush()
    dataset.close()

    console.log(`✅ TIFF "${tileName}.tif" создан. Размер: ${xSize}x${ySize} px`)
}
