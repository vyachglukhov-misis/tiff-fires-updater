export type GetSectorDataResult = {
  status: "error" | "success";
  tileName: string;
  pixelsData: Float32Array<ArrayBuffer>;
  maxCoefficient: number;
  sizes: {
    xSize: number;
    ySize: number;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    pixelSizeLon: number;
    pixelSizeLat: number;
  };
  proj: string;
};

export type SectorData = Omit<GetSectorDataResult, "status">;
