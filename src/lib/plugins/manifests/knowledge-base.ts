import { ModuleManifest } from '../plugin.types';

const knowledgeBaseManifest: ModuleManifest = {
  id: 'knowledge-base',
  icon: 'BookOpen',
  titleKey: 'plugins.knowledgeBaseTitle',
  descKey: 'plugins.knowledgeBaseDesc',
  primary: false,
  routePath: 'knowledge-base',
  order: 3,
};

export default knowledgeBaseManifest;
