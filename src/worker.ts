import { Feature } from "geojson";
import { writeToTileFeature } from "./writeFeatureToTile";

process.on("message", async (msg: { feature: Feature; tileName: string }) => {
  const { feature, tileName } = msg;

  try {
    const creatingTiffResult = await writeToTileFeature(feature, tileName);

    process.exit(0);
  } catch (err: any) {
    process.send?.({ status: "error", tileName, error: err.message });
    process.exit(1);
  }
});
