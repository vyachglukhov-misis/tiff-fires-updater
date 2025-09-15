import fs from "fs";
import path from "path";
import bboxPolygon from "@turf/bbox-polygon";
import booleanIntersects from "@turf/boolean-intersects";
import { bbox, featureCollection } from "@turf/turf";
import intersect from "@turf/intersect";
import combine from "@turf/combine";
import * as turf from "@turf/turf";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { writeToTileFeature } from "./index_copy";
import pLimit from "p-limit";
import { Worker } from "worker_threads";


(async () => {
  const krasnoyarskGeoJSON: Feature<MultiPolygon> = JSON.parse(
    fs.readFileSync(__dirname + "/krasnoyarsk_krai.geojson", "utf-8")
  ).features[0];

  const N = 64;

  // 1. BBOX региона
  const regionBbox = bbox(krasnoyarskGeoJSON);
  const numCols = Math.ceil(Math.sqrt(N));
  const numRows = Math.ceil(N / numCols);
  const [minX, minY, maxX, maxY] = regionBbox;
  const deltaX = (maxX - minX) / numCols;
  const deltaY = (maxY - minY) / numRows;

  // 2. Сетка
  const resultCells = [];
  for (let i = 0; i < numRows; i++) {
    for (let j = 0; j < numCols; j++) {
      const cellMinX = minX + j * deltaX;
      const cellMinY = minY + i * deltaY;
      const cellMaxX = cellMinX + deltaX;
      const cellMaxY = cellMinY + deltaY;

      const cell = bboxPolygon([cellMinX, cellMinY, cellMaxX, cellMaxY]);

      if (booleanIntersects(cell, krasnoyarskGeoJSON)) {
        resultCells.push(cell);
      }
    }
  }

  const gridFeatureCollection = featureCollection(resultCells);
  fs.writeFileSync(
    __dirname + "/krasnoyarsk_grid.geojson",
    JSON.stringify(gridFeatureCollection, null, 2)
  );

  // 3. Пересечения
  const intersectedObjects = [];
  for (const cell of gridFeatureCollection.features) {
    const normalizedCell = turf.multiPolygon([cell.geometry.coordinates as any]);
    const result = intersect(turf.featureCollection([krasnoyarskGeoJSON, normalizedCell]));
    if (result) intersectedObjects.push(result);
  }

  const intersectedFeatureCollection = featureCollection(intersectedObjects);
  fs.writeFileSync(
    __dirname + "/krasnoyarsk_intersected.geojson",
    JSON.stringify(intersectedFeatureCollection, null, 2)
  );

  // 4. Убедиться, что папка tiles существует
  const outputDir = path.join(__dirname, "tiles");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(__dirname)
  const maxWorkers = 1
const limit = pLimit(maxWorkers)
let index = 0
const promises = intersectedObjects.map(feature => {
  const tileName = `tile_${++index}`

  return limit(() =>
    new Promise<void>((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, "worker.js"), {
        workerData: { feature, tileName },
      })

      worker.on("message", (msg: any) => {
        if (msg.status === "done") {
          console.log(`✅ Воркер завершил ${msg.tileName}`)
          resolve()
        } else {
          console.error(`❌ Ошибка в воркере ${msg.tileName}: ${msg.error}`)
          reject(msg.error)
        }
      })

      worker.on("error", reject)
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker exited with code ${code}`))
      })
    })
  )
})

await Promise.all(promises)
console.log("🏁 Все воркеры завершены.")

})();
