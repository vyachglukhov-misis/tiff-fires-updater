import fs from "fs"
import { Feature, Point } from "geojson"
import _ from "lodash"
import { pathsToRegion, REGIONS } from "../types/regions.enum"

type FireBase = {
    geo: Feature<Point>
    name: string
    createdAt: string
    id: string
}

export type ParamFromObject<T> = {
    pathToParam: string
    paramName: string
    converter: (val: unknown) => T
}

type ParamsToObject<T extends readonly ParamFromObject<any>[]> = {
    [K in T[number] as K["paramName"]]: ReturnType<K["converter"]>
}

export type FireObject<T extends Record<string, unknown> = {}> = FireBase & T

export type FireObjectWithWeighedParams = FireObject<ParamsToObject<any>>

export const getFiresObjectsWithOtherParams = <const T extends readonly ParamFromObject<any>[]>(
    region: REGIONS,
    params: T
) => {
    const { fires: firesRawPath } = pathsToRegion[region]
    const firesObjects = JSON.parse(fs.readFileSync(firesRawPath, "utf-8"))

    const fires: FireObjectWithWeighedParams[] = firesObjects
        .filter(
            (obj: any) =>
                !obj.deleted && obj.object.geo && obj.object.geo.geometry && obj.object.geo.geometry.type === "Point"
        )
        .map((obj: any) => {
            const paramsData = params.reduce((acc, cur) => {
                const { paramName, pathToParam, converter } = cur
                const rawValue = _.get(obj, pathToParam)
                return { ...acc, [paramName]: converter(rawValue) }
            }, {} as ParamsToObject<T>)
            return {
                ...paramsData,
                geo: {
                    type: "Feature",
                    geometry: obj.object.geo.geometry,
                    properties: {},
                },
                name: obj.name,
                createdAt: obj.created,
                id: obj._id,
            }
        })
    return fires
}
