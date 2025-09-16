import { Router } from "express"
import { listCrons, startCron, stopCron } from "../controllers/cron.controller"

const router = Router()

router.post("cron/start", startCron)
router.post("cron/stop", stopCron)
router.get("cron/list", listCrons)
