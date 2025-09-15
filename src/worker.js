const {  parentPort, workerData, isMainThread } = require('worker_threads')
const { writeToTileFeature } = require("./index_copy.ts")

const { feature, tileName } = workerData

writeToTileFeature(feature, tileName)
  .then(() => {
    parentPort?.postMessage({ status: "done", tileName })
  })
  .catch(err => {
    parentPort?.postMessage({ status: "error", tileName, error: err.message })
  })