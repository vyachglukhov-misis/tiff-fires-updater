import { Feature, MultiPolygon, Polygon } from "geojson"
import { getTileData } from "../getTileData"
import fs from "fs"
import path from "path"
import { workingDirectories } from "../chores/directoriesManager"

const { RESULT_OUTPUT_DIR } = workingDirectories

process.on("message", async (msg: { feature: Feature; tileName: string; globalProj: string }) => {
    const { feature, tileName, globalProj } = msg

    try {
        const creatingTiffResult = await getTileData(feature, tileName, globalProj)

        const pathToWriteTiffResultData = path.join(RESULT_OUTPUT_DIR, `${creatingTiffResult.tileName}__result.json`)
        try {
            const jsoned = JSON.stringify(creatingTiffResult)
            fs.writeFileSync(pathToWriteTiffResultData, jsoned)
        } catch (e) {
            console.error(e)
        }

        process.send?.({ status: "created", tiffDataPath: pathToWriteTiffResultData })
        // console.log((process.memoryUsage().rss / 1024 / 1024).toFixed(2), 'MB')
        process.exit(0)
    } catch (err: any) {
        console.error(err)
        process.send?.({ status: "error", tileName, error: err.message })
        process.exit(1)
    }
})
