import fs from "fs"
import path from "path"
import os from "os"
const PROJECT_SRC = path.join(__dirname, "..")

const TMP_DIR = path.join(os.tmpdir(), "tiff-fires-updater")

export const workingDirectories = {
    MAIN_TIFF_OUTPUT_DIR: path.join(PROJECT_SRC, "main_tiff"), // куда упадёт сшитый тифф

    // куда падают .txt файлы со списком {fileName}.tiff (для работы gdal_merge.py)
    OPT_OUTPUT_DIR: path.join(TMP_DIR, "tiff_filenames"),

    // куда падают .json файлы - результаты после генерации тифа
    RESULT_OUTPUT_DIR: path.join(TMP_DIR, "sector_data"),

    // куда падают отдельно сгенерированные тифы
    TILES_OUTPUT_DIR: path.join(PROJECT_SRC, "tiles"),
}

const { OPT_OUTPUT_DIR, RESULT_OUTPUT_DIR, TILES_OUTPUT_DIR } = workingDirectories

const directories = [
    { dirname: OPT_OUTPUT_DIR, fileExtensions: [".txt"] },
    { dirname: RESULT_OUTPUT_DIR, fileExtensions: [".json"] },
    { dirname: TILES_OUTPUT_DIR, fileExtensions: [".tif"] },
]

export const createDirectories = () => {
    for (const dir of directories) {
        const { dirname } = dir
        fs.mkdirSync(dirname, { recursive: true })
    }
}

export const cleanDirectories = () => {
    for (const dir of directories) {
        const { dirname, fileExtensions } = dir

        deleteFilesFromDirectory(dirname, fileExtensions)
    }
}

const deleteFilesFromDirectory = (dirPath: string, fileExtensionsToDelete: string[]) => {
    try {
        const filesToDelete = fs
            .readdirSync(dirPath)
            .filter(fileName => fileExtensionsToDelete.some(el => fileName.endsWith(el)))
            .map(f => path.join(dirPath, f))

        for (const filePath of filesToDelete) {
            fs.rmSync(filePath, { recursive: true, force: true })
        }
        return { ok: true, message: `Удалено ${filesToDelete.length} файлов` }
    } catch (e) {
        return { ok: false, error: (e as Error).message }
    }
}
