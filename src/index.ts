import fs from "fs";
import path from "path";
import bboxPolygon from "@turf/bbox-polygon";
import booleanIntersects from "@turf/boolean-intersects";
import { bbox, featureCollection } from "@turf/turf";
import intersect from "@turf/intersect";
import * as turf from "@turf/turf";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import pLimit from "p-limit";
import { Worker } from "worker_threads";
import { fork } from "child_process";
import { CustomCliTable } from "./table";
import { divideGeojsonOnNSectors } from "./utils/divideGeojsonOnNSectors";
import { config } from "./config";

(async () => {
  const krasnoyarskGeoJSON: Feature<MultiPolygon> = JSON.parse(
    fs.readFileSync(__dirname + "/krasnoyarsk_krai.geojson", "utf-8")
  ).features[0];

  const dividedGeojson = divideGeojsonOnNSectors(
    krasnoyarskGeoJSON,
    config.dividingSectors
  );

  const limit = pLimit(8);

  let index = 0;
  const promises = dividedGeojson.features.map((feature) =>
    limit(
      () =>
        new Promise<void>((resolve, reject) => {
          const tileName = `tile_${++index}`;
          const child = fork(path.join(__dirname, "worker.ts"), {
            execArgv: ["-r", "ts-node/register/transpile-only"],
          });

          // Отправляем данные в дочерний процесс
          child.send({ feature, tileName });

          // Ловим сообщения из дочернего процесса
          child.on("message", (msg: any) => {
            if (msg.status === "created") {
              console.log(`✅ Child завершил ${msg.tileName}`);
              resolve();
            } else if (msg.status) {
              const { tileName, progress } = msg;
              // table.updateProgress(tileName, progress);
            } else {
              console.error(`❌ Ошибка в Child ${msg.tileName}: ${msg.error}`);
              reject(msg.error);
            }
          });

          child.on("error", reject);
          child.on("exit", (code) => {
            if (code !== 0) reject(new Error(`Child exited with code ${code}`));
          });
        })
    )
  );

  await Promise.all(promises).catch((e) => console.log(e));
  console.log("🏁 Все процессы завершены.");
})();
