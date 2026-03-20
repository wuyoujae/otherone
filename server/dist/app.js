"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const env_1 = require("./config/env");
const error_handler_1 = require("./middleware/error-handler");
const health_routes_1 = __importDefault(require("./modules/health/health.routes"));
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const project_routes_1 = __importDefault(require("./modules/project/project.routes"));
const setup_routes_1 = __importDefault(require("./modules/setup/setup.routes"));
const plugins_1 = require("./plugins");
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: env_1.env.corsOrigin, credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api/health', health_routes_1.default);
app.use('/api/auth', auth_routes_1.default);
app.use('/api/projects', project_routes_1.default);
app.use('/api/setup', setup_routes_1.default);
// Auto-mount plugin routes
for (const plugin of plugins_1.pluginRegistry.getAll()) {
    app.use(`/api/${plugin.routePrefix}`, plugin.router);
}
// Plugin metadata discovery endpoint
app.get('/api/plugins', (_req, res) => {
    const plugins = plugins_1.pluginRegistry.getAll().map((p) => ({
        id: p.id,
        version: p.version,
        routePrefix: p.routePrefix,
    }));
    res.json({ success: true, data: plugins });
});
app.use(error_handler_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map