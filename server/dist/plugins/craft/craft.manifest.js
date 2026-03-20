"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const craft_routes_1 = __importDefault(require("./craft.routes"));
const craft_service_1 = require("./craft.service");
const craftManifest = {
    id: 'craft',
    routePrefix: 'craft',
    router: craft_routes_1.default,
    version: '1.0.0',
    hooks: {
        onProjectCreate: craft_service_1.initCraftForProject,
        onProjectDelete: craft_service_1.deleteCraftForProject,
    },
};
exports.default = craftManifest;
//# sourceMappingURL=craft.manifest.js.map