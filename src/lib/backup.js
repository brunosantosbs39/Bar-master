// src/lib/backup.js — Backup via API do servidor

export async function exportData() {
  const r = await fetch('/api/backup');
  const data = await r.json();
  return JSON.stringify(data, null, 2);
}

export async function importData(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    const r = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error('Falha ao importar no servidor');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function resetData() {
  await fetch('/api/backup', { method: 'DELETE' });
  window.location.reload();
}
