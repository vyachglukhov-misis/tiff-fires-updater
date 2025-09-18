import { Feature, MultiPolygon, Polygon } from "geojson";
import { getTileData } from "../getTileData";

process.on(
  "message",
  async (msg: { feature: Feature; tileName: string; globalProj: string }) => {
    const { feature, tileName, globalProj } = msg;

    try {
      const creatingTiffResult = await getTileData(
        feature,
        tileName,
        globalProj
      );

      process.send?.({ status: "created", ...creatingTiffResult });
    } catch (err: any) {
      console.log(err.message);
      process.send?.({ status: "error", tileName, error: err.message });
      process.exit(1);
    }
  }
);
