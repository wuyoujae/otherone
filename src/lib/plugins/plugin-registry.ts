import { Sparkles, CheckSquare, BookOpen, type LucideIcon } from 'lucide-react';
import { ModuleManifest } from './plugin.types';
import craftManifest from './manifests/craft';
import todoManifest from './manifests/todo';
import knowledgeBaseManifest from './manifests/knowledge-base';

const allModules: ModuleManifest[] = [
  craftManifest,
  todoManifest,
  knowledgeBaseManifest,
].sort((a, b) => a.order - b.order);

const iconMap: Record<string, LucideIcon> = {
  Sparkles,
  CheckSquare,
  BookOpen,
};

export function getAllModules(): ModuleManifest[] {
  return allModules;
}

export function getModuleById(id: string): ModuleManifest | undefined {
  return allModules.find((m) => m.id === id);
}

export function getModuleIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Sparkles;
}
