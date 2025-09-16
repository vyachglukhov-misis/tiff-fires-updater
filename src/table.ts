var CliTable3 = require("cli-table3");
import {
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Polygon,
} from "geojson";

interface TileStatus {
  tileName: string;
  progress: number; // 0..100
}

export class CustomCliTable {
  private table: any;
  private statuses: TileStatus[];

  constructor(
    public intersectedFeatureCollection: FeatureCollection<
      Polygon | MultiPolygon,
      GeoJsonProperties
    >
  ) {
    this.statuses = intersectedFeatureCollection.features.map((f, i) => ({
      tileName: `tile_${i + 1}`,
      progress: 0,
    }));

    this.table = this.createTable();
    // this.render(); // начальная таблица
  }

  /** Создать новый объект таблицы */
  private createTable() {
    return new CliTable3({
      head: ["Tile", "Progress"],
      colWidths: [15, 10],
    });
  }

  /** Обновить прогресс конкретного тайла (0..100) */
  public updateProgress(tileName: string, progress: number) {
    const tile = this.statuses.find((t) => t.tileName === tileName);
    if (!tile) return;

    tile.progress = progress;
    this.render();
  }

  /** Отрисовать таблицу в консоли */
  private render() {
    // Перемещаем курсор в начало и очищаем экран
    process.stdout.write("\x1b[H\x1b[2J");

    this.table = this.createTable();
    this.statuses.forEach((t) => {
      this.table.push([t.tileName, `${t.progress}%`]);
    });

    console.log(this.table.toString());
  }

  /** Установить прогресс всех тайлов в 100% (например, при завершении) */
  public completeAll() {
    this.statuses.forEach((t) => (t.progress = 100));
    this.render();
  }
}
