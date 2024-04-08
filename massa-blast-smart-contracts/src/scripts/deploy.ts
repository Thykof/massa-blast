import { config } from 'dotenv';
import { deployBlaster } from '../lib/deploy';
config();

await deployBlaster();
