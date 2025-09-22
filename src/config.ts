export const config = {
    dividingSectors: 256, // на сколько секторов делить регион
    maxChildProcesses: 8, // макс. число дочерних процессов
    pixelSize: 90, // размер пикселя в метрах
    calcCoeffFunction(dist: number): number {
        const D = this.reliableDistance
        if (dist >= D) return 0
        const t = 1 - dist / D
        return t * t * t
    },
    reliableDistance: 10000, // Радиус влияния D (метры), за пределами которого вклад точки считается нулевым.
    normalization: {
        gamma: 0.5, // меньше 1 → поднимаем малые значения
        minVisible: 0.000001, // минимальный порог, чтобы слабые значения были видны
    },
    isUseGlobalProj: true,
}
