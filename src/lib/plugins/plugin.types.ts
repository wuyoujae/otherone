export interface ModuleManifest {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
  primary: boolean;
  routePath: string;
  order: number;
}
