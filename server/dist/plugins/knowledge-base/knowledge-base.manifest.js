"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const knowledge_base_routes_1 = __importDefault(require("./knowledge-base.routes"));
const knowledge_base_service_1 = require("./knowledge-base.service");
const knowledgeBaseManifest = {
    id: 'knowledge-base',
    routePrefix: 'knowledge-base',
    router: knowledge_base_routes_1.default,
    version: '1.0.0',
    hooks: {
        onProjectDelete: knowledge_base_service_1.deleteArticlesForProject,
    },
};
exports.default = knowledgeBaseManifest;
//# sourceMappingURL=knowledge-base.manifest.js.map