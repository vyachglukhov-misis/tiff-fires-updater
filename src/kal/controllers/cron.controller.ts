import { Request, Response } from "express"

export const startCron = (req: Request, res: Response) => {
    const { name, schedule } = req.body
}

export const stopCron = (req: Request, res: Response) => {}
export const listCrons = (req: Request, res: Response) => {}
