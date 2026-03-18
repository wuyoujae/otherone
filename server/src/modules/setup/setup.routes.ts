import { Router } from 'express';
import { testDatabase, checkDatabase, checkTables, initDatabase } from './setup.controller';

const router = Router();

router.post('/test-database', testDatabase);
router.get('/check-database', checkDatabase);
router.get('/check-tables', checkTables);
router.post('/init-database', initDatabase);

export default router;
