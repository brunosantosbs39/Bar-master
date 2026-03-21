// server/tunnel.js - Tunel publico (cloudflared sem tela de senha)
import { spawn } from 'child_process';
import { existsSync, createWriteStream, accessSync, statSync } from 'fs';
import { unlink } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let _tunnelUrl = null;
export const getTunnelUrl = () => _tunnelUrl;

export async function startTunnel(vitePort) {
  const candidates = [
    join(ROOT, 'cloudflared.exe'),
    join(ROOT, 'cf-extract', 'cloudflared.exe'),
    'cloudflared',
  ];

  let cfBin = null;
  for (const c of candidates) {
    try { accessSync(c); if (statSync(c).size > 1024) { cfBin = c; break; } } catch (_e) { /* tenta proximo */ }
  }

  if (!cfBin) {
    const dest = join(ROOT, 'cloudflared.exe');
    console.log('   Baixando cloudflared.exe...');
    try {
      await downloadFile(
        'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe',
        dest
      );
      cfBin = dest;
      console.log('   cloudflared.exe baixado!');
    } catch (_e) {
      console.log('   Nao foi possivel baixar cloudflared. Usando localtunnel...');
      return startLocaltunnel(vitePort);
    }
  }

  console.log('   Abrindo tunel cloudflare (sem tela de senha)...');
  return new Promise((resolve) => {
    const args = ['tunnel', '--url', 'http://localhost:' + vitePort, '--no-autoupdate'];
    let proc;
    try {
      proc = spawn(cfBin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (_e) {
      console.log('   Erro ao iniciar cloudflared. Tentando localtunnel...');
      startLocaltunnel(vitePort).then(resolve);
      return;
    }

    let found = false;
    const urlPattern = new RegExp('https://[a-z0-9-]+[.]trycloudflare[.]com');

    const handler = (data) => {
      const text = data.toString();
      const match = urlPattern.exec(text);
      if (match && !found) {
        found = true;
        _tunnelUrl = match[0];
        console.log('   Tunel ativo: ' + _tunnelUrl);
        console.log('   QR Code funciona em qualquer celular (dados moveis)');
        registerWithWorker(_tunnelUrl); // fire-and-forget: tunnel is ready regardless of Worker registration
        resolve();
      }
    };

    proc.stdout.on('data', handler);
    proc.stderr.on('data', handler);
    proc.on('exit', () => { _tunnelUrl = null; deregisterFromWorker(); });
    proc.on('error', async () => { await startLocaltunnel(vitePort); resolve(); });

    setTimeout(() => {
      if (!found) {
        console.log('   Timeout cloudflared. Tentando localtunnel...');
        startLocaltunnel(vitePort).then(resolve);
      }
    }, 30000);
  });
}

async function startLocaltunnel(vitePort) {
  try {
    const { default: localtunnel } = await import('localtunnel');
    const tunnel = await localtunnel({ port: vitePort });
    _tunnelUrl = tunnel.url;
    console.log('   Localtunnel ativo: ' + _tunnelUrl);
    console.log('   Aviso: exige senha no 1o acesso. Acesse loca.lt/mytunnelpassword');
    tunnel.on('close', () => { _tunnelUrl = null; });
    tunnel.on('error', () => { _tunnelUrl = null; });
  } catch (_e) {
    console.log('   Sem internet - tunel indisponivel.');
    console.log('   QR Code funcionara apenas na rede Wi-Fi local.');
  }
}

// ── Cloudflare Worker URL Broker ─────────────────────────────────────────────

async function registerWithWorker(tunnelUrl) {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) return;
  if (!workerUrl.startsWith('https://')) {
    console.log('   WORKER_URL deve usar HTTPS. Registro ignorado.');
    return;
  }

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${workerUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${workerSecret}`,
        },
        body: JSON.stringify({ url: tunnelUrl }),
      });
      if (res.ok) {
        console.log('   🌐 Worker registrado: URL permanente ativa');
        console.log('   ' + workerUrl + '/menu');
        return;
      }
      if (res.status >= 400 && res.status < 500) {
        console.log(`   Worker: erro ${res.status}. Verifique WORKER_SECRET.`);
        return;
      }
    } catch (_e) { /* tenta novamente */ }
    if (attempt < 3) await new Promise(r => setTimeout(r, 2000));
  }
  console.log('   Aviso: Worker nao disponivel. Usando URL do tunnel diretamente.');
}

async function deregisterFromWorker() {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) return;
  try {
    await fetch(`${workerUrl}/register`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${workerSecret}` },
    });
  } catch (_e) { /* best-effort — processo encerrando */ }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const request = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          return request(res.headers.location);
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', (e) => { unlink(dest, () => {}); reject(e); });
    };
    request(url);
  });
}
