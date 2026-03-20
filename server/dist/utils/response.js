"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSuccess = sendSuccess;
exports.sendError = sendError;
function sendSuccess(res, data, message, statusCode = 200) {
    const body = { success: true, data };
    if (message) {
        body.message = message;
    }
    res.status(statusCode).json(body);
}
function sendError(res, message, statusCode = 400) {
    const body = { success: false, message };
    res.status(statusCode).json(body);
}
//# sourceMappingURL=response.js.map