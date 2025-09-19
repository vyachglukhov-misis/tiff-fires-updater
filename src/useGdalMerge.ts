import path from "path"
import fs from "fs"
import { exec } from "child_process"
import { workingDirectories } from "./chores/directoriesManager"

const now = String(Date.now())

const { OPT_OUTPUT_DIR, TILES_OUTPUT_DIR, MAIN_TIFF_OUTPUT_DIR } = workingDirectories

const OPT_OUTPUT_FILENAME = OPT_OUTPUT_DIR + `/${now}.txt`
console.log(OPT_OUTPUT_FILENAME)
const MAIN_TIFF_OUTPUT_FILENAME = MAIN_TIFF_OUTPUT_DIR + `/${now}.tif`

const getCmd = (inputFilesListDist: string, OUTPUT_FILE: string) =>
    `gdal_merge.py -ot UInt16 -of GTiff -o "${OUTPUT_FILE}" --optfile "${inputFilesListDist}" -co COMPRESS=DEFLATE`

export const useGdalMerge = async () => {
    return new Promise((res, rej) => {
        const tileFiles = fs
            .readdirSync(TILES_OUTPUT_DIR)
            .filter(f => f.endsWith(".tif"))
            .map(f => path.join(TILES_OUTPUT_DIR, f))
            .join("\n")

        fs.writeFileSync(OPT_OUTPUT_FILENAME, tileFiles)

        const cmd = getCmd(OPT_OUTPUT_FILENAME, MAIN_TIFF_OUTPUT_FILENAME)

        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                console.error(error.message)
                return rej(error)
            }
            if (stderr) {
                console.error(stderr)
                return rej(stderr)
            }

            console.log("stdout:", stdout)
            res(true)
        })
    })
}
