// src/lib/backup.js
// Exportar, importar e resetar todos os dados do localStorage (prefixo bm_)

const PREFIX = 'bm_';

function getBmKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) keys.push(key);
  }
  return keys;
}

export function exportData() {
  const data = {};
  getBmKeys().forEach(key => {
    data[key] = localStorage.getItem(key);
  });
  return JSON.stringify(data, null, 2);
}

export function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (typeof data !== 'object' || data === null) throw new Error('Arquivo inválido');
    // Remove dados atuais
    getBmKeys().forEach(k => localStorage.removeItem(k));
    // Importa novos dados
    Object.entries(data).forEach(([k, v]) => {
      if (k.startsWith(PREFIX)) localStorage.setItem(k, v);
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export function resetData() {
  getBmKeys().forEach(k => localStorage.removeItem(k));
  window.location.reload();
}
