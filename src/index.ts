import fs from "fs";
import path, { format } from "path";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import pLimit from "p-limit";
import { fork } from "child_process";
import { divideGeojsonOnNSectors } from "./utils/divideGeojsonOnNSectors";
import { config } from "./config";
import { formatDuration } from "./utils/formatDuration";
import { GetSectorDataResult, SectorData } from "./types/sectorData";

function getSectorsDataPromises(features: Feature[]) {
  const limit = pLimit(config.maxChildProcesses);
  let index = 0;

  const promises = features.map((feature) =>
    limit(
      () =>
        new Promise<GetSectorDataResult>((resolve, reject) => {
          const tileName = `tile_${++index}`;
          const child = fork(
            path.join(__dirname, "workers", "getSectorData.worker.ts"),
            {
              execArgv: ["-r", "ts-node/register/transpile-only"],
            }
          );

          // Отправляем данные в дочерний процесс
          child.send({ feature, tileName });

          // Ловим сообщения из дочернего процесса
          child.on("message", (msg: any) => {
            if (msg.status === "created") {
              console.log(
                `✅ ${child.pid} Child получил данные по тифу ${msg.tileName}. MaxCoefficient: ${msg.maxCoefficient}`
              );
              resolve(msg);
            } else if (msg.status === "progress") {
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
  return promises;
}

function getWriteSectorsToTiffsPromises(
  sectorsData: SectorData[],
  maxCoefficient: number
) {
  const limit = pLimit(config.maxChildProcesses);

  const promises = sectorsData.map((sectorData) =>
    limit(() => {
      return new Promise<void>((resolve, reject) => {
        const child = fork(
          path.join(__dirname, "workers", "writeSectorDataToTiff.worker..ts"),
          {
            execArgv: ["-r", "ts-node/register/transpile-only"],
          }
        );

        // Отправляем данные в дочерний процесс
        child.send({ sectorData, maxCoefficient });

        // Ловим сообщения из дочернего процесса
        child.on("message", (msg: any) => {
          if (msg.status === "writed") {
            console.log(
              `✅ ${child.pid} Child завершил запись ${msg.tileName}. pixelsAffected: ${msg.pixelsAffected}`
            );
            resolve(msg);
          } else if (msg.status === "progress") {
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
      });
    })
  );
  return promises;
}

(async () => {
  const krasnoyarskGeoJSON: Feature<MultiPolygon> = JSON.parse(
    fs.readFileSync(__dirname + "/norilsk.geojson", "utf-8")
  ).features[0];

  const dividedGeojson = divideGeojsonOnNSectors(
    krasnoyarskGeoJSON,
    config.dividingSectors
  );

  fs.writeFileSync(
    __dirname + "/norilsk_grid.geojson",
    JSON.stringify(dividedGeojson)
  );

  const now = Date.now();
  const sectorDataPromises = getSectorsDataPromises(dividedGeojson.features);

  const sectorsDataResults = await Promise.all(sectorDataPromises);
  const sectorsData: SectorData[] = sectorsDataResults.map(
    ({ status, ...rest }) => rest
  );

  const maxCoefficient = sectorsData.reduce(
    (acc, r) => Math.max(acc, r.maxCoefficient),
    -Infinity
  );
  console.log("MAX_COEFFICIENT:", maxCoefficient);

  const writingSectorDataPromises = getWriteSectorsToTiffsPromises(
    sectorsData,
    maxCoefficient
  );

  await Promise.all(writingSectorDataPromises);

  console.log("Все дочерние процессы завершены.");
  console.log(`Время выполнения: ${formatDuration(Date.now() - now)}`);
})();
