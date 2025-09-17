import CliTable3 from "cli-table3";
import * as readline from "readline";
import {
  Feature,
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
  private statuses: TileStatus[];
  private lastHeight = 0;

  constructor(public features: Feature[]) {
    this.statuses = features.map((f, i) => ({
      tileName: `tile_${i + 1}`,
      progress: 0,
    }));

    this.render(); // первая отрисовка
  }

  /** Построить таблицу */
  private buildTable(): string {
    const table = new CliTable3({
      head: ["Tile", "Progress"],
      colWidths: [15, 15],
    });

    this.statuses.forEach((t) => {
      table.push([t.tileName, `${t.progress}%`]);
    });

    return table.toString();
  }

  /** Первая отрисовка */
  private render() {
    const tableStr = this.buildTable();
    console.log(tableStr);
    this.lastHeight = tableStr.split("\n").length;
  }

  /** Перерисовать таблицу на месте */
  private redraw() {
    // поднимаем курсор на количество строк предыдущей таблицы
    readline.moveCursor(process.stdout, 0, -this.lastHeight);
    readline.clearScreenDown(process.stdout);

    const tableStr = this.buildTable();
    process.stdout.write(tableStr + "\n");
    this.lastHeight = tableStr.split("\n").length;
  }

  /** Обновить прогресс конкретного тайла */
  public updateProgress(tileName: string, progress: number) {
    const tile = this.statuses.find((t) => t.tileName === tileName);
    if (!tile) return;
    tile.progress = progress;
    this.redraw();
  }

  /** Завершить */
  public completeAll() {
    this.statuses.forEach((t) => (t.progress = 100));
    this.redraw();
  }
}
