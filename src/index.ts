import fs from "fs"
import path, { format } from "path"
import { Feature, MultiPolygon } from "geojson"
import pLimit from "p-limit"
import { fork } from "child_process"
import { divideGeojsonOnNSectors } from "./utils/divideGeojsonOnNSectors"
import { config } from "./config"
import { formatDuration } from "./utils/formatDuration"
import { SectorData } from "./types/sectorData.type"

import {
    FireObject,
    FireObjectWithWeighedParams,
    getFiresObjectsWithOtherParams,
    ParamFromObject,
} from "./fires/getFires"
import { cleanDirectories, createDirectories } from "./chores/directoriesManager"
import { useGdalMerge } from "./pipelines/useGdalMerge"
import { paramsToRegion, pathsToRegion, REGIONS, WeightedParam } from "./types/regions.enum"

function getSectorsDataPromises(
    features: Feature[],
    firesObjects: FireObjectWithWeighedParams[],
    params: WeightedParam<any>[]
) {
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
                    child.send({ feature, tileName, firesObjects, params })

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

function getWriteSectorsToTiffsPromises(sectorsData: SectorData[], paramsMaxCoeff: Record<string, number>) {
    const limit = pLimit(config.maxChildProcesses)

    const promises = sectorsData.map(sectorData =>
        limit(() => {
            return new Promise<void>((resolve, reject) => {
                const child = fork(path.join(__dirname, "workers", "writeSectorDataToTiff.worker..ts"), {
                    execArgv: ["-r", "ts-node/register/transpile-only"],
                })

                // Отправляем данные в дочерний процесс
                child.send({ sectorData, paramsMaxCoeff })

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
    createDirectories()
    cleanDirectories()

    const now = Date.now()

    const region = REGIONS.HB

    const { geojson: inputGeojsonPath } = pathsToRegion[region]

    const geojson: Feature<MultiPolygon> = JSON.parse(fs.readFileSync(inputGeojsonPath, "utf-8")).features[0]

    const dividedGeojson = divideGeojsonOnNSectors(geojson, config.dividingSectors)

    const otherParams = paramsToRegion[region]

    const firesObjects = getFiresObjectsWithOtherParams(region, otherParams)

    const sectorDataPromises = getSectorsDataPromises(dividedGeojson.features, firesObjects, otherParams)
    const sectorsData = await Promise.all(sectorDataPromises)

    const paramsMaxCoeff = sectorsData.reduce<Record<string, number>>((acc, sectorData) => {
        const { paramsData } = sectorData

        Object.entries(paramsData).forEach(([paramName, param]) => {
            const { maxCoeff } = param
            if (!acc[paramName]) {
                acc[paramName] = maxCoeff
                return acc
            }
            acc[paramName] = maxCoeff > acc[paramName] ? maxCoeff : acc[paramName]
        })

        return acc
    }, {})
    console.log(paramsMaxCoeff)

    const writingSectorDataPromises = getWriteSectorsToTiffsPromises(sectorsData, paramsMaxCoeff)

    await Promise.all(writingSectorDataPromises)

    sectorsData.length = 0
    useGdalMerge()

    console.log("Все дочерние процессы завершены.")
    console.log(`Время выполнения: ${formatDuration(Date.now() - now)}`)
})()
