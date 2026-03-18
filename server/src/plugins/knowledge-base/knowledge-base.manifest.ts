import { PluginManifest } from '../plugin.types';
import router from './knowledge-base.routes';
import { deleteArticlesForProject } from './knowledge-base.service';

const knowledgeBaseManifest: PluginManifest = {
  id: 'knowledge-base',
  routePrefix: 'knowledge-base',
  router,
  version: '1.0.0',
  hooks: {
    onProjectDelete: deleteArticlesForProject,
  },
};

export default knowledgeBaseManifest;
