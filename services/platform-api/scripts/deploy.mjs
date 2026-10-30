import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Keep legacy npm aliases on the same verified production release path.
const script=fileURLToPath(new URL('../../../scripts/deploy-production.sh',import.meta.url));
const result=spawnSync('bash',[script,...process.argv.slice(2)],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status===0?0:1);
