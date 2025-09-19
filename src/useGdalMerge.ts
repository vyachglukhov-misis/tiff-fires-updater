import path from "path"
import fs from "fs"
import { exec } from "child_process"

const now = String(Date.now())

const OUTPUT_FILE = path.join(__dirname, "main_tiff", now + ".tif")
const TILE_DIR = path.join(__dirname, "tiles")
const OPT_FILE = path.join(__dirname, "opt", now + ".txt")

const getCmd = (inputFilesListDist: string, OUTPUT_FILE: string) =>
    `gdal_merge.py -ot Byte -of GTiff -o "${OUTPUT_FILE}" --optfile "${inputFilesListDist}" -co COMPRESS=DEFLATE`

export const useGdalMerge = async () => {
    return new Promise((res, rej) => {
        const tileFiles = fs
            .readdirSync(TILE_DIR)
            .filter(f => f.endsWith(".tif"))
            .map(f => path.join(TILE_DIR, f))
            .join("\n")
        fs.writeFileSync(OPT_FILE, tileFiles)

        const cmd = getCmd(OPT_FILE, OUTPUT_FILE)

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
