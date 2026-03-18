import { pluginRegistry } from './plugin-registry';
import craftManifest from './craft/craft.manifest';
import todoManifest from './todo/todo.manifest';
import knowledgeBaseManifest from './knowledge-base/knowledge-base.manifest';

pluginRegistry.register(craftManifest);
pluginRegistry.register(todoManifest);
pluginRegistry.register(knowledgeBaseManifest);

export { pluginRegistry };
