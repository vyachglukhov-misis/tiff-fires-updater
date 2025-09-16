export const config = {
  dividingSectors: 64, // на сколько секторов делить регион
  maxChildProcesses: 8, // макс. число дочерних процессов
  pixelSize: 90, // размер пикселя в метрах
  expFunction(d: number) {
    return Math.exp(d / this.D);
  }, // экспоненциальная функция для расчета коэффициента горимости
  D: 10000, // параметр D (в метрах) для экспоненциальной функции
};
