import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import healthRoutes from './modules/health/health.routes';
import authRoutes from './modules/auth/auth.routes';
import projectRoutes from './modules/project/project.routes';
import setupRoutes from './modules/setup/setup.routes';
import { pluginRegistry } from './plugins';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/setup', setupRoutes);

// Auto-mount plugin routes
for (const plugin of pluginRegistry.getAll()) {
  app.use(`/api/${plugin.routePrefix}`, plugin.router);
}

// Plugin metadata discovery endpoint
app.get('/api/plugins', (_req, res) => {
  const plugins = pluginRegistry.getAll().map((p) => ({
    id: p.id,
    version: p.version,
    routePrefix: p.routePrefix,
  }));
  res.json({ success: true, data: plugins });
});

app.use(errorHandler);

export default app;
