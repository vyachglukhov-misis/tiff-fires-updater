const fs = require("fs");
const turf = require("@turf/turf");

const read = JSON.parse(fs.readFileSync(__dirname + "/fires.json", "utf-8"));

const mapped = read
  .filter(
    (obj) => obj.object.geo.geometry && obj.object.geo.geometry.type === "Point"
  )
  .map((obj) => ({
    type: "Feature",
    geometry: obj.object.geo.geometry,
    properties: {},
  }));

fs.writeFileSync(
  __dirname + "/fires_mapped.geojson",
  JSON.stringify(turf.featureCollection(mapped))
);
