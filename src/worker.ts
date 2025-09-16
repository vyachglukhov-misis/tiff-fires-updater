import { writeToTileFeature } from "./writeFeatureToTile";

process.on("message", async (msg: { feature: any; tileName: string }) => {
  const { feature, tileName } = msg;

  try {
    const creatingTiffResult = await writeToTileFeature(feature, tileName);

    if (
      creatingTiffResult.ok &&
      creatingTiffResult.message?.status === "created"
    ) {
      process.send?.({ status: "created", tileName });
    }
    process.exit(0);
  } catch (err: any) {
    process.send?.({ status: "error", tileName, error: err.message });
    process.exit(1);
  }
});
