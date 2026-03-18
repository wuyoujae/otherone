import { Router } from 'express';

export interface PluginManifest {
  id: string;
  routePrefix: string;
  router: Router;
  version: string;
  hooks?: {
    onProjectCreate?: (projectId: string, userId: string) => Promise<void>;
    onProjectDelete?: (projectId: string) => Promise<void>;
  };
}
