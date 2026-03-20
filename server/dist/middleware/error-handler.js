"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const env_1 = require("../config/env");
function errorHandler(err, _req, res, _next) {
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
        success: false,
        message: env_1.env.nodeEnv === 'production' ? 'Internal server error' : err.message,
        ...(env_1.env.nodeEnv !== 'production' && { stack: err.stack }),
    });
}
//# sourceMappingURL=error-handler.js.map