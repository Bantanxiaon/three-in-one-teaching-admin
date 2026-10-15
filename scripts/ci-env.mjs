import {randomBytes} from "node:crypto";
import {appendFileSync} from "node:fs";
if (!process.env.CI || !process.env.GITHUB_ENV) throw new Error("This helper is for ephemeral GitHub Actions databases only.");
const values={AUTH_SECRET:randomBytes(32).toString("base64"),TEMPORARY_PASSWORD_ENCRYPTION_KEY:randomBytes(32).toString("base64"),ADMIN_SEED_PASSWORD:randomBytes(24).toString("base64url")};
for(const [key,value] of Object.entries(values)){console.log("::add-mask::"+value);appendFileSync(process.env.GITHUB_ENV,key+"="+value+"\n");}
