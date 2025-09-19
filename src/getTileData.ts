import * as turf from "@turf/turf"
import type { Feature } from "geojson"
import { getFiresObjects, getFiresObjectsProjected, getUTMProjection, reprojectGeoJSON } from "./fires/getFires"
import { config } from "./config"
import rbush from "rbush"

export const getTileData = async (feature: Feature, tileName: string, globalProj: string) => {
    const [minLon, minLat, maxLon, maxLat] = turf.bbox(feature)

    // Размер пикселя в градусах по широте
    const pixelSizeDegLat = config.pixelSize / 111000 // 1° широты ≈ 111 км

    // Размер пикселя в градусах по долготе зависит от широты
    const latCenter = (minLat + maxLat) / 2
    const pixelSizeDegLon = config.pixelSize / (111000 * Math.cos((latCenter * Math.PI) / 180))

    const xSize = Math.ceil((maxLon - minLon) / pixelSizeDegLon)
    const ySize = Math.ceil((maxLat - minLat) / pixelSizeDegLat)

    const tempData = new Float32Array(xSize * ySize).fill(0)

    // Подготовка точек пожаров
    const firesObject = getFiresObjects()
    const firesPoints = firesObject
        .filter(f => f.geo?.geometry?.type === "Point")
        .map(f => {
            const [lon, lat] = f.geo.geometry.coordinates
            return { lon, lat }
        })

    // Индекс для быстрого поиска (в градусах)
    const fireIndex = new rbush<{
        minX: number
        minY: number
        maxX: number
        maxY: number
        lon: number
        lat: number
    }>()
    fireIndex.load(
        firesPoints.map(f => ({
            minX: f.lon,
            minY: f.lat,
            maxX: f.lon,
            maxY: f.lat,
            ...f,
        }))
    )

    // MAX_DIST в градусах
    const maxDistDegLat = config.reliableDistance / 111000
    const maxDistDegLon = config.reliableDistance / (111000 * Math.cos((latCenter * Math.PI) / 180))

    let max_fires_sum_rate = 0

    for (let y = 0; y < ySize; y++) {
        const py = maxLat - y * pixelSizeDegLat - pixelSizeDegLat / 2
        for (let x = 0; x < xSize; x++) {
            const px = minLon + x * pixelSizeDegLon + pixelSizeDegLon / 2

            const nearbyFires = fireIndex.search({
                minX: px - maxDistDegLon,
                minY: py - maxDistDegLat,
                maxX: px + maxDistDegLon,
                maxY: py + maxDistDegLat,
            })

            let coeff = 0
            for (const fire of nearbyFires) {
                // Расстояние в метрах
                const dx = (fire.lon - px) * 111000 * Math.cos((py * Math.PI) / 180)
                const dy = (fire.lat - py) * 111000
                const dist = Math.sqrt(dx * dx + dy * dy)
                if (dist <= config.reliableDistance) {
                    coeff += config.kernel(dist)
                }
            }

            tempData[y * xSize + x] = coeff
            if (coeff > max_fires_sum_rate) max_fires_sum_rate = coeff
        }
    }

    return {
        tileName,
        pixelsData: Array.from(tempData),
        maxCoefficient: max_fires_sum_rate,
        sizes: {
            xSize,
            ySize,
            minX: minLon,
            minY: minLat,
            maxX: maxLon,
            maxY: maxLat,
            pixelSizeLon: pixelSizeDegLon,
            pixelSizeLat: pixelSizeDegLat,
        },
        proj: "EPSG:4326",
    }
}
