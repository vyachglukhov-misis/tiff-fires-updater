export const config = {
    dividingSectors: 32, // на сколько секторов делить регион
    maxChildProcesses: 12, // макс. число дочерних процессов
    pixelSize: 90, // размер пикселя в метрах
    calcCoeffFunction(dist: number): number {
        const D = this.reliableDistance
        if (dist >= D) return 0
        return Math.exp(-dist / D)
    },
    reliableDistance: 10000, // Радиус влияния D (метры), за пределами которого вклад точки считается нулевым.
    normalization: {
        gamma: 0.6, // меньше 1 → поднимаем малые значения
        minVisible: 0.000001, // минимальный порог, чтобы слабые значения были видны
    },
    isUseGlobalProj: true,
}
