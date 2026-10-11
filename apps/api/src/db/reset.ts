/**
 * Deletes the embedded database so the next start creates and seeds it again.
 * It refuses to touch a real PostgreSQL server.
 */
import { loadConfig, loadEnvFile } from '../config';
import { removeData } from './embedded';

loadEnvFile();
const config = loadConfig();

if (config.databaseUrl) {
  console.error('DATABASE_URL is set. This command only resets the embedded database.');
  process.exit(1);
}

removeData(config.dataDir);
console.log(`Removed ${config.dataDir}. It will be created again on the next start.`);
