import { PluginManifest } from './plugin.types';

class PluginRegistry {
  private plugins = new Map<string, PluginManifest>();

  register(manifest: PluginManifest): void {
    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin "${manifest.id}" is already registered`);
    }
    this.plugins.set(manifest.id, manifest);
  }

  get(id: string): PluginManifest | undefined {
    return this.plugins.get(id);
  }

  getAll(): PluginManifest[] {
    return Array.from(this.plugins.values());
  }

  async onProjectCreate(projectId: string, userId: string): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.onProjectCreate) {
        await plugin.hooks.onProjectCreate(projectId, userId);
      }
    }
  }

  async onProjectDelete(projectId: string): Promise<void> {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks?.onProjectDelete) {
        await plugin.hooks.onProjectDelete(projectId);
      }
    }
  }
}

export const pluginRegistry = new PluginRegistry();
