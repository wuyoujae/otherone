"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const todo_routes_1 = __importDefault(require("./todo.routes"));
const todo_service_1 = require("./todo.service");
const todoManifest = {
    id: 'todo',
    routePrefix: 'todo',
    router: todo_routes_1.default,
    version: '1.0.0',
    hooks: {
        onProjectDelete: todo_service_1.deleteAllForProject,
    },
};
exports.default = todoManifest;
//# sourceMappingURL=todo.manifest.js.map