import { Feature, MultiPolygon, Polygon } from "geojson"
import fs from "fs"
import path from "path"
import { workingDirectories } from "../chores/directoriesManager"
import { getTileData } from "../pipelines/getTileData"
import { FireObject, FireObjectWithWeighedParams } from "../fires/getFires"
import { WeightedParam } from "../types/regions.enum"

const { RESULT_OUTPUT_DIR } = workingDirectories

process.on(
    "message",
    async (msg: {
        feature: any
        tileName: string
        globalProj: string
        firesObjects: FireObjectWithWeighedParams[]
        params: WeightedParam<any>[]
    }) => {
        const { feature, tileName, firesObjects, params } = msg

        try {
            const creatingTiffResult = await getTileData(feature, tileName, firesObjects, params)

            const pathToWriteTiffResultData = path.join(
                RESULT_OUTPUT_DIR,
                `${creatingTiffResult.tileName}__result.json`
            )
            try {
                const jsoned = JSON.stringify(creatingTiffResult)
                fs.writeFileSync(pathToWriteTiffResultData, jsoned)
            } catch (e) {
                console.error(e)
            }

            process.send?.({ status: "created", tiffDataPath: pathToWriteTiffResultData })
            process.exit(0)
        } catch (err: any) {
            console.error(err)
            process.send?.({ status: "error", tileName, error: err.message })
            process.exit(1)
        }
    }
)
