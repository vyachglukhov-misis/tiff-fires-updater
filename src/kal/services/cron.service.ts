import { Request, Response } from "express"
import { ScheduledTask } from "node-cron"

const tasks: Record<string, ScheduledTask> = {}

export const startCron = (req: Request, res: Response) => {}
export const stopCron = (req: Request, res: Response) => {}
export const listCrons = (req: Request, res: Response) => {}
