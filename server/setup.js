// server/setup.js — Verificação de primeiro uso do Worker URL Broker
// Chamado na inicialização do servidor. Se .env não existir ou WORKER_SECRET
// não estiver definido, gera um secret e exibe instruções de setup.

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '.env');

export function ensureWorkerConfig() {
  // Se .env existe e WORKER_SECRET já tem valor, nada a fazer
  if (existsSync(ENV_PATH)) {
    const content = readFileSync(ENV_PATH, 'utf8');
    const match = content.match(/^WORKER_SECRET=(.+)$/m);
    if (match && match[1].trim()) return;

    // .env existe mas WORKER_SECRET está ausente ou vazio — fazer patch
    const secret = randomUUID();
    let patched = content;
    if (/^WORKER_SECRET=/m.test(patched)) {
      patched = patched.replace(/^WORKER_SECRET=.*$/m, `WORKER_SECRET=${secret}`);
    } else {
      patched = patched.trimEnd() + `\nWORKER_SECRET=${secret}\n`;
    }
    if (!/^WORKER_URL=/m.test(patched)) {
      patched = `WORKER_URL=\n` + patched;
    }
    writeFileSync(ENV_PATH, patched);
    printSetupInstructions(secret);
    return;
  }

  // .env não existe — criar do zero
  const secret = randomUUID();
  const envContent = `# Cloudflare Workers URL Broker\nWORKER_URL=\nWORKER_SECRET=${secret}\n`;
  writeFileSync(ENV_PATH, envContent);
  printSetupInstructions(secret);
}

function printSetupInstructions(secret) {
  console.log('\n====================================================');
  console.log('SETUP NECESSÁRIO — Cloudflare Workers URL Broker');
  console.log('====================================================');
  console.log('Secret gerado e salvo em .env\n');
  console.log('Para ativar a URL permanente do cardápio:');
  console.log('  1. Crie conta gratuita em cloudflare.com');
  console.log('  2. Execute: npm install -g wrangler');
  console.log('  3. Execute: wrangler login');
  console.log('  4. Execute: wrangler kv:namespace create TUNNEL_URL');
  console.log('  5. Cole o ID retornado em worker/wrangler.toml');
  console.log('  6. Execute: cd worker && wrangler deploy');
  console.log('  7. Execute: wrangler secret put WORKER_SECRET');
  console.log(`     Quando solicitado, cole: ${secret}`);
  console.log('  8. Edite .env: preencha WORKER_URL com a URL do deploy');
  console.log('\nO servidor funciona normalmente sem o Worker.');
  console.log('====================================================\n');
}
