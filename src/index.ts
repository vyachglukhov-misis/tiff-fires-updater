import fs from "fs"
import path, { format } from "path"
import { Feature, MultiPolygon } from "geojson"
import pLimit from "p-limit"
import { fork } from "child_process"
import { divideGeojsonOnNSectors } from "./utils/divideGeojsonOnNSectors"
import { config } from "./config"
import { formatDuration } from "./utils/formatDuration"
import { SectorData } from "./types/sectorData"

import * as turf from "@turf/turf"
import { getUTMProjection } from "./fires/getFires"
import { useGdalMerge } from "./useGdalMerge"
import { cleanDirectories, createDirectories } from "./chores/directoriesManager"

function getSectorsDataPromises(features: Feature[], globalProj: string) {
    const limit = pLimit(config.maxChildProcesses)
    let index = 0

    const promises = features.map(feature =>
        limit(
            () =>
                new Promise<SectorData>((resolve, reject) => {
                    const tileName = `tile_${++index}`
                    const child = fork(path.join(__dirname, "workers", "getSectorData.worker.ts"), {
                        execArgv: ["-r", "ts-node/register/transpile-only", "--max-old-space-size=1024"],
                    })

                    // Отправляем данные в дочерний процесс
                    child.send({ feature, tileName, globalProj })

                    // Ловим сообщения из дочернего процесса
                    child.on("message", (msg: any) => {
                        if (msg.status === "created") {
                            const pathToRead = msg.tiffDataPath

                            const sectorData = JSON.parse(fs.readFileSync(pathToRead, "utf-8"))

                            console.log(
                                `✅ ${child.pid} Child получил данные по тифу ${sectorData.tileName}. MaxCoefficient: ${sectorData.maxCoefficient}`
                            )
                            console.log((process.memoryUsage().rss / 1024 / 1024).toFixed(2), "MB")
                            resolve(sectorData)
                        } else if (msg.status === "progress") {
                            const { tileName, progress } = msg
                            // table.updateProgress(tileName, progress);
                        } else {
                            console.error(`❌ Ошибка в Child ${msg.tileName}: ${msg.error}`)
                            reject(msg.error)
                        }
                    })

                    child.on("error", reject)
                    child.on("exit", code => {
                        if (code !== 0) reject(new Error(`Child exited with code ${code}`))
                    })
                })
        )
    )
    return promises
}

function getWriteSectorsToTiffsPromises(sectorsData: SectorData[], maxCoefficient: number) {
    const limit = pLimit(config.maxChildProcesses)

    const promises = sectorsData.map(sectorData =>
        limit(() => {
            return new Promise<void>((resolve, reject) => {
                const child = fork(path.join(__dirname, "workers", "writeSectorDataToTiff.worker..ts"), {
                    execArgv: ["-r", "ts-node/register/transpile-only"],
                })

                // Отправляем данные в дочерний процесс
                child.send({ sectorData, maxCoefficient })

                // Ловим сообщения из дочернего процесса
                child.on("message", (msg: any) => {
                    if (msg.status === "writed") {
                        console.log(
                            `✅ ${child.pid} Child завершил запись ${msg.tileName}. pixelsAffected: ${msg.pixelsAffected}`
                        )
                        resolve(msg)
                    } else if (msg.status === "progress") {
                        const { tileName, progress } = msg
                        // table.updateProgress(tileName, progress);
                    } else {
                        console.error(`❌ Ошибка в Child ${msg.tileName}: ${msg.error}`)
                        reject(msg.error)
                    }
                })

                child.on("error", reject)
                child.on("exit", code => {
                    if (code !== 0) reject(new Error(`Child exited with code ${code}`))
                })
            })
        })
    )
    return promises
}

;(async () => {
    if (global.gc) {
        global.gc()
    }

    createDirectories()
    cleanDirectories()

    const now = Date.now()
    const krasnoyarskGeoJSON: Feature<MultiPolygon> = JSON.parse(
        fs.readFileSync(__dirname + "/krasnoyarsk_krai.geojson", "utf-8")
    ).features[0]

    const dividedGeojson = divideGeojsonOnNSectors(krasnoyarskGeoJSON, config.dividingSectors)

    const centroid = turf.centroid(krasnoyarskGeoJSON).geometry.coordinates
    const { proj: globalProj } = getUTMProjection(centroid[0], centroid[1])

    console.log(globalProj)

    fs.writeFileSync(__dirname + "/krasnoyarsk_krai_grid.geojson", JSON.stringify(dividedGeojson))

    const sectorDataPromises = getSectorsDataPromises(dividedGeojson.features, globalProj)

    const sectorsData = await Promise.all(sectorDataPromises)

    const maxCoefficient = sectorsData.reduce((acc, r) => Math.max(acc, r.maxCoefficient), -Infinity)
    console.log("MAX_COEFFICIENT:", maxCoefficient)

    const writingSectorDataPromises = getWriteSectorsToTiffsPromises(sectorsData, maxCoefficient)

    await Promise.all(writingSectorDataPromises)

    sectorsData.length = 0
    if (global.gc) {
        global.gc()
    }
    useGdalMerge()

    console.log("Все дочерние процессы завершены.")
    console.log(`Время выполнения: ${formatDuration(Date.now() - now)}`)
})()
