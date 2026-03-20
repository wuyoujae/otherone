"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRegistry = void 0;
const plugin_registry_1 = require("./plugin-registry");
Object.defineProperty(exports, "pluginRegistry", { enumerable: true, get: function () { return plugin_registry_1.pluginRegistry; } });
const craft_manifest_1 = __importDefault(require("./craft/craft.manifest"));
const todo_manifest_1 = __importDefault(require("./todo/todo.manifest"));
const knowledge_base_manifest_1 = __importDefault(require("./knowledge-base/knowledge-base.manifest"));
plugin_registry_1.pluginRegistry.register(craft_manifest_1.default);
plugin_registry_1.pluginRegistry.register(todo_manifest_1.default);
plugin_registry_1.pluginRegistry.register(knowledge_base_manifest_1.default);
//# sourceMappingURL=index.js.map