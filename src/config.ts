export const config = {
    dividingSectors: 256, // на сколько секторов делить регион
    maxChildProcesses: 8, // макс. число дочерних процессов
    pixelSize: 90, // размер пикселя в метрах
    gaussian(d: number) {
        const sigma = this.reliableDistance / 2
        const D = this.reliableDistance
        if (d >= D) return 0

        const exp0 = Math.exp(-(d * d) / (2 * sigma * sigma))
        const expD = Math.exp(-(D * D) / (2 * sigma * sigma))

        return (exp0 - expD) / (1 - expD)
    }, // экспоненциальная функция для расчета коэффициента горимости
    reliableDistance: 10000, // Радиус влияния D (метры), за пределами которого вклад точки считается нулевым.
    normalization: {
        gamma: 0.5, // меньше 1 → поднимаем малые значения
        minVisible: 0.000001, // минимальный порог, чтобы слабые значения были видны
    },
    isUseGlobalProj: true,
}
