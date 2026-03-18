import { PluginManifest } from '../plugin.types';
import router from './craft.routes';
import { initCraftForProject, deleteCraftForProject } from './craft.service';

const craftManifest: PluginManifest = {
  id: 'craft',
  routePrefix: 'craft',
  router,
  version: '1.0.0',
  hooks: {
    onProjectCreate: initCraftForProject,
    onProjectDelete: deleteCraftForProject,
  },
};

export default craftManifest;
