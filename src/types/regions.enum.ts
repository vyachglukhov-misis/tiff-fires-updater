import path from "path"
import { PROJECT_SRC } from "../chores/directoriesManager"
import e from "cors"
import { ParamFromObject } from "../fires/getFires"

export enum REGIONS {
    KS = "krasnoyarsk",
    NK = "norilsk",
    HB = "habarovsk",
}

// можно сделать конфиг под каждый регион под одним типом и помещать туда параметры с весами
export const pathsToRegion = {
    [REGIONS.KS]: {
        geojson: path.join(PROJECT_SRC, "data", "krasnoyarsk", "krasnoyarsk_krai.geojson"),
        fires: path.join(PROJECT_SRC, "data", "krasnoyarsk", "fires_krasnoyarsk.json"),
    },
    [REGIONS.NK]: {
        geojson: path.join(PROJECT_SRC, "data", "norilsk", "norilsk.geojson"),
        fires: path.join(PROJECT_SRC, "data", "krasnoyarsk", "fires_krasnoyarsk.json"),
    },
    [REGIONS.HB]: {
        geojson: path.join(PROJECT_SRC, "data", "habarovsk", "habarovsk-region.json"),
        fires: path.join(PROJECT_SRC, "data", "habarovsk", "fires_habarovsk.json"),
    },
}

export type WeightedParam<T> = ParamFromObject<T> & { weight: number }

export const paramsToRegion: Record<REGIONS, WeightedParam<any>[]> = {
    [REGIONS.HB]: [
        {
            pathToParam: "object.bc3aef97b9a21dc7900e64d534dc4e0c9.areaBurn",
            paramName: "areaBurn",
            converter: (val: unknown) => {
                if (typeof val === "string") return Number(val)
                return 0
            },
            weight: 0.95,
        },
    ],
    [REGIONS.KS]: [],
    [REGIONS.NK]: [],
}
