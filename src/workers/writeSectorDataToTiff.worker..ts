import { Feature } from "geojson";
import { getTileData } from "../getTileData";
import { writeSectorsDataToTiff } from "../writeSectorsDataToTiff";
import { SectorData } from "../types/sectorData";

process.on(
  "message",
  async (msg: { sectorData: SectorData; maxCoefficient: number }) => {
    const { sectorData, maxCoefficient } = msg;

    try {
      const writingTiffResult = await writeSectorsDataToTiff(
        sectorData,
        maxCoefficient
      );

      if (writingTiffResult.ok) {
        process.send?.({ status: "writed", ...writingTiffResult.message });
      } else {
        throw new Error(writingTiffResult.error);
      }
    } catch (err: any) {
      process.send?.({ status: "error", error: err.message });
      process.exit(1);
    }
  }
);
