import * as turf from "@turf/turf"
import fs from "fs"
import { Feature, MultiPolygon } from "geojson"
import path from "path"

export const divideGeojsonOnNSectors = (geojson: Feature<MultiPolygon>, NSectors: number) => {
    // 1. BBOX региона
    const regionBbox = turf.bbox(geojson)
    const numCols = Math.ceil(Math.sqrt(NSectors))
    const numRows = Math.ceil(NSectors / numCols)
    const [minX, minY, maxX, maxY] = regionBbox
    const deltaX = (maxX - minX) / numCols
    const deltaY = (maxY - minY) / numRows

    // 2. Сетка
    const resultCells = []
    for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
            const cellMinX = minX + j * deltaX
            const cellMinY = minY + i * deltaY
            const cellMaxX = cellMinX + deltaX
            const cellMaxY = cellMinY + deltaY

            const cell = turf.bboxPolygon([cellMinX, cellMinY, cellMaxX, cellMaxY])

            resultCells.push(cell)
            continue
            if (turf.booleanIntersects(cell, geojson)) {
                resultCells.push(cell)
            }
        }
    }

    const gridFeatureCollection = turf.featureCollection(resultCells)

    // 3. Пересечения
    const intersectedObjects = []
    for (const cell of gridFeatureCollection.features) {
        const normalizedCell = turf.multiPolygon([cell.geometry.coordinates as any])
        const result = turf.intersect(turf.featureCollection([geojson, normalizedCell]))
        if (result) intersectedObjects.push(result)
    }

    const intersectedFeatureCollection = turf.featureCollection(intersectedObjects)
    return gridFeatureCollection
}
