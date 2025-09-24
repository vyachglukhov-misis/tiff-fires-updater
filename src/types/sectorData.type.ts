export type GetSectorDataResult = {
    status: "created" | "error"
    tileName: string
    maxCoefficient: number
    sizes: {
        xSize: number
        ySize: number
        minX: number
        minY: number
        maxX: number
        maxY: number
        pixelSizeLon: number
        pixelSizeLat: number
    }
    proj: "EPSG:4326"
    paramsData: Record<
        string,
        {
            maxCoeff: number
            paramData: Float32Array
            weight: number
        }
    >
}

export type SectorData = Omit<GetSectorDataResult, "status">
