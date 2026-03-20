"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const setup_controller_1 = require("./setup.controller");
const router = (0, express_1.Router)();
router.post('/test-database', setup_controller_1.testDatabase);
router.get('/check-database', setup_controller_1.checkDatabase);
router.get('/check-tables', setup_controller_1.checkTables);
router.post('/check-tables', setup_controller_1.checkTables);
router.post('/init-database', setup_controller_1.initDatabase);
exports.default = router;
//# sourceMappingURL=setup.routes.js.map