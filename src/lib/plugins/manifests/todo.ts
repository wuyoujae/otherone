import { ModuleManifest } from '../plugin.types';

const todoManifest: ModuleManifest = {
  id: 'todo',
  icon: 'CheckSquare',
  titleKey: 'plugins.todoTitle',
  descKey: 'plugins.todoDesc',
  primary: false,
  routePath: 'todo',
  order: 2,
};

export default todoManifest;
