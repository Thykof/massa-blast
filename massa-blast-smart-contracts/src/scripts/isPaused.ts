import { getClient } from '../lib/utils';
import { config } from 'dotenv';
import { isPaused } from '../lib/pause';
config();

const { client } = await getClient(process.env.SECRET_KEY_USER_1!);
const result = await isPaused(client);
console.log(`isPaused: ${result}`);
