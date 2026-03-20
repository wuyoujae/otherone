"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHealth = getHealth;
const response_1 = require("../../utils/response");
const startTime = Date.now();
function getHealth(_req, res) {
    (0, response_1.sendSuccess)(res, {
        status: 'ok',
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=health.controller.js.map