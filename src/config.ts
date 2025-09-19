export const config = {
    dividingSectors: 512, // на сколько секторов делить регион
    maxChildProcesses: 16, // макс. число дочерних процессов
    pixelSize: 30, // размер пикселя в метрах
    expFunction(d: number) {
        return Math.exp(-(d / this.reliableDistance))
    }, // экспоненциальная функция для расчета коэффициента горимости
    reliableDistance: 7650 * 2, // Радиус влияния D (метры), за пределами которого вклад точки считается нулевым.
    isUseGlobalProj: true,
}
