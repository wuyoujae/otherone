import { PluginManifest } from './plugin.types';
declare class PluginRegistry {
    private plugins;
    register(manifest: PluginManifest): void;
    get(id: string): PluginManifest | undefined;
    getAll(): PluginManifest[];
    onProjectCreate(projectId: string, userId: string): Promise<void>;
    onProjectDelete(projectId: string): Promise<void>;
}
export declare const pluginRegistry: PluginRegistry;
export {};
//# sourceMappingURL=plugin-registry.d.ts.map