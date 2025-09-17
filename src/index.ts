import fs from "fs";
import path, { format } from "path";
import { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import pLimit from "p-limit";
import { fork } from "child_process";
import { divideGeojsonOnNSectors } from "./utils/divideGeojsonOnNSectors";
import { config } from "./config";
import { formatDuration } from "./utils/formatDuration";

function createChildProcesses(features: Feature[]) {
  const limit = pLimit(config.maxChildProcesses);
  let index = 0;

  const promises = features.map((feature) =>
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
              console.log(
                `✅ ${child.pid} Child завершил ${msg.tileName}. Размер: ${msg.size}. Существует контент: ${msg.contentExists}`
              );
              resolve();
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

(async () => {
  const krasnoyarskGeoJSON: Feature<MultiPolygon> = JSON.parse(
    fs.readFileSync(__dirname + "/krasnoyarsk_krai.geojson", "utf-8")
  ).features[0];

  const dividedGeojson = divideGeojsonOnNSectors(
    krasnoyarskGeoJSON,
    config.dividingSectors
  );

  fs.writeFileSync(
    __dirname + "/krasnoyarsk_intersected.geojson",
    JSON.stringify(dividedGeojson)
  );

  const promises = createChildProcesses(dividedGeojson.features);

  const now = Date.now();
  await Promise.all(promises);
  console.log("Все дочерние процессы завершены.");
  console.log(`Время выполнения: ${formatDuration(Date.now() - now)}`);
})();
