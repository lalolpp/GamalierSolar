import { writeFileSync } from "node:fs";

writeFileSync(new URL("../public/version.txt", import.meta.url), String(Date.now()));
