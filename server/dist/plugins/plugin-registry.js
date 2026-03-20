"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pluginRegistry = void 0;
class PluginRegistry {
    constructor() {
        this.plugins = new Map();
    }
    register(manifest) {
        if (this.plugins.has(manifest.id)) {
            throw new Error(`Plugin "${manifest.id}" is already registered`);
        }
        this.plugins.set(manifest.id, manifest);
    }
    get(id) {
        return this.plugins.get(id);
    }
    getAll() {
        return Array.from(this.plugins.values());
    }
    async onProjectCreate(projectId, userId) {
        for (const plugin of this.plugins.values()) {
            if (plugin.hooks?.onProjectCreate) {
                await plugin.hooks.onProjectCreate(projectId, userId);
            }
        }
    }
    async onProjectDelete(projectId) {
        for (const plugin of this.plugins.values()) {
            if (plugin.hooks?.onProjectDelete) {
                await plugin.hooks.onProjectDelete(projectId);
            }
        }
    }
}
exports.pluginRegistry = new PluginRegistry();
//# sourceMappingURL=plugin-registry.js.map