// Import first in any script so .env.local is loaded before modules read process.env.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
