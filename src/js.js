const fs = require("fs");
const turf = require("@turf/turf");

const read = JSON.parse(fs.readFileSync('/ssd/backend/stand/tiff-fires-updater/src/out/tile_3__result.json', "utf-8"));

console.log(read)
// const mapped = read
//   .filter(
//     (obj) => obj.object.geo.geometry && obj.object.geo.geometry.type === "Point"
//   )
//   .map((obj) => ({
//     type: "Feature",
//     geometry: obj.object.geo.geometry,
//     properties: {},
//   }));

// fs.writeFileSync(
//   __dirname + "/fires_mapped.geojson",
//   JSON.stringify(turf.featureCollection(mapped))
// );
