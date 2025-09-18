import { Feature, MultiPolygon, Polygon } from "geojson";
import { getTileData } from "../getTileData";

process.on("message", async (msg: { feature: Feature; tileName: string }) => {
  const { feature, tileName } = msg;

  try {
    const creatingTiffResult = await getTileData(feature, tileName);

    process.send?.({ status: "created", ...creatingTiffResult });
  } catch (err: any) {
    console.log(err.message);
    process.send?.({ status: "error", tileName, error: err.message });
    process.exit(1);
  }
});
