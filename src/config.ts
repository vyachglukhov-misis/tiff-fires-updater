export const config = {
  dividingSectors: 16, // на сколько секторов делить регион
  maxChildProcesses: 8, // макс. число дочерних процессов
  pixelSize: 90, // размер пикселя в метрах
  expFunction(d: number) {
    return Math.exp(-(d / this.reliableDistance));
  }, // экспоненциальная функция для расчета коэффициента горимости
  reliableDistance: 5000, // Радиус влияния D (метры), за пределами которого вклад точки считается нулевым.
  isUseGlobalProj: true,
};
