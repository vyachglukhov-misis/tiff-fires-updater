import { Feature } from "geojson"
import { SectorData } from "../types/sectorData.type"
import { writeSectorsDataToTiff } from "../pipelines/writeSectorsDataToTiff"

process.on("message", async (msg: { sectorData: SectorData; paramsMaxCoeff: Record<string, number> }) => {
    const { sectorData, paramsMaxCoeff } = msg

    try {
        const writingTiffResult = await writeSectorsDataToTiff(sectorData, paramsMaxCoeff)

        if (writingTiffResult.ok) {
            process.send?.({ status: "writed", ...writingTiffResult.message })
            process.exit(0)
        } else {
            throw new Error(writingTiffResult.error)
        }
    } catch (err: any) {
        process.send?.({ status: "error", error: err.message })
        process.exit(1)
    }
})
