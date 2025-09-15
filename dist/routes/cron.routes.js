"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cron_controller_1 = require("../controllers/cron.controller");
const router = (0, express_1.Router)();
router.post("cron/start", cron_controller_1.startCron);
router.post("cron/stop", cron_controller_1.stopCron);
router.get("cron/list", cron_controller_1.listCrons);
//# sourceMappingURL=cron.routes.js.map