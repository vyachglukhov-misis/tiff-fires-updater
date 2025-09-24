import * as turf from "@turf/turf"
import type { Feature } from "geojson"
import { FireObject, FireObjectWithWeighedParams } from "../fires/getFires"
import { config } from "../config"
import rbush from "rbush"
import { WeightedParam } from "../types/regions.enum"
import { GetSectorDataResult } from "../types/sectorData.type"

export const getTileData = async (
    feature: Feature,
    tileName: string,
    firesObjects: FireObjectWithWeighedParams[],
    params: WeightedParam<any>[]
): Promise<GetSectorDataResult> => {
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
    const firesPoints = firesObjects
        .filter(f => f.geo?.geometry?.type === "Point")
        .map(f => {
            const [lon, lat] = f.geo.geometry.coordinates
            return { lon, lat, ...f }
        })

    // Индекс для быстрого поиска (в градусах)
    const fireIndex = new rbush<
        {
            minX: number
            minY: number
            maxX: number
            maxY: number
            lon: number
            lat: number
        } & FireObjectWithWeighedParams
    >()
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

    // const paramResults = params.map(p => ({
    //     paramName: p.paramName,
    //     paramWeight: p.weight,
    //     paramMaxCoeff: -Infinity,
    //     paramData: new Float32Array(xSize * ySize).fill(0),
    // }))

    const paramsData = Object.entries(params).reduce<
        Record<string, { maxCoeff: number; paramData: Float32Array; weight: number }>
    >((acc, cur) => {
        const [_key, param] = cur
        const { paramName, weight } = param
        acc[paramName] = { maxCoeff: -Infinity, paramData: new Float32Array(xSize * ySize).fill(0), weight }
        return acc
    }, {})

    const geoWeight = params.reduce((acc, cur) => {
        return acc - cur.weight
    }, 1)
    paramsData["geo"] = {
        maxCoeff: -Infinity,
        paramData: new Float32Array(xSize * ySize).fill(0),
        weight: geoWeight,
    }

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
                    coeff += config.calcCoeffFunction(dist)
                    params.forEach(p => {
                        const { paramName } = p
                        if (fire[paramName]) {
                            paramsData[paramName].paramData[y * xSize + x] += fire[paramName]
                            paramsData[paramName].maxCoeff = Math.max(fire[paramName], paramsData[paramName].maxCoeff)
                        }
                    })
                }
            }

            paramsData["geo"].paramData[y * xSize + x] = coeff

            if (coeff > paramsData["geo"].maxCoeff) {
                paramsData["geo"].maxCoeff = coeff
            }
        }
    }

    return {
        status: "created",
        tileName,
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
        paramsData,
    }
}
