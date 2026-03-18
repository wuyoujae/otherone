import { PluginManifest } from '../plugin.types';
import router from './todo.routes';
import { deleteAllForProject } from './todo.service';

const todoManifest: PluginManifest = {
  id: 'todo',
  routePrefix: 'todo',
  router,
  version: '1.0.0',
  hooks: {
    onProjectDelete: deleteAllForProject,
  },
};

export default todoManifest;
