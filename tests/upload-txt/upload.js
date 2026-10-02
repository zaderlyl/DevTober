const UPLOAD_URL = 'https://web-mmi2.iutbeziers.fr/~lilian.cornet/upload.php';   // valeur par défaut du champ
const MAX_BYTES = 20 * 1024;          // la même limite que côté serveur (qui reste seul juge)
const TIMEOUT_MS = 8000;

const $ = id => document.getElementById(id);
const server = $('server'), drop = $('drop'), fileInput = $('file'), sendBtn = $('send');
const chosenBox = $('chosen'), chosenRows = $('chosen-rows'), preview = $('preview');
const receiptBox = $('receipt'), receiptRows = $('receipt-rows'), list = $('list'), refresh = $('refresh');
const steps = [...document.querySelectorAll('#steps li')];

let file = null;        // le fichier choisi
let localHash = null;   // son empreinte, calculée dans le navigateur

// l'URL du serveur est retenue d'une visite à l'autre
server.value = UPLOAD_URL;
try { server.value = localStorage.getItem('devtober-upload-url') || UPLOAD_URL; } catch (e) {}
server.addEventListener('change', () => {
  try { localStorage.setItem('devtober-upload-url', server.value.trim()); } catch (e) {}
  loadList();
});

// ---- la frise : l'état de chaque étape (pending / active / done / error)
function setStep(i, state, detail = '') {
  steps[i].className = state === 'pending' ? '' : state;
  steps[i].querySelector('.d').textContent = detail;
}
function resetSteps() { steps.forEach((_, i) => setStep(i, 'pending')); }

// tout ce qui vient du fichier ou du serveur passe par textContent : jamais interprété comme du HTML
function rows(box, items) {
  box.replaceChildren();
  for (const [k, v, cls] of items) {
    const row = document.createElement('div'); row.className = 'kv';
    const kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k;
    const vv = document.createElement('span'); vv.className = 'v' + (cls ? ' ' + cls : ''); vv.textContent = v;
    row.append(kk, vv);
    box.appendChild(row);
  }
}

const fmtSize = b => b < 1024 ? `${b} octets` : `${(b / 1024).toFixed(1)} Ko`;

async function sha256(buffer) {
  if (!window.crypto || !crypto.subtle) return null;   // pas de contexte sécurisé : pas d'empreinte
  const h = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- choisir un fichier : clic, clavier ou glisser-déposer
drop.addEventListener('click', () => fileInput.click());
drop.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
fileInput.addEventListener('change', () => fileInput.files[0] && choose(fileInput.files[0]));
['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', e => e.dataTransfer.files[0] && choose(e.dataTransfer.files[0]));

async function choose(f) {
  file = null; localHash = null;
  resetSteps();
  receiptBox.hidden = true;
  chosenBox.hidden = false;
  sendBtn.disabled = true;
  preview.textContent = '';
  rows(chosenRows, [['nom', f.name], ['taille', fmtSize(f.size)]]);
  setStep(0, 'done', `${f.name} · ${fmtSize(f.size)}`);
  setStep(1, 'active', 'vérification…');

  // les mêmes contrôles que le serveur, pour répondre tout de suite (le serveur les refait : lui seul fait foi)
  const problem = await check(f);
  if (problem) {
    setStep(1, 'error', problem);
    rows(chosenRows, [['nom', f.name], ['taille', fmtSize(f.size)], ['problème', problem, 'bad']]);
    return;
  }
  const text = await f.text();
  localHash = await sha256(await f.arrayBuffer());
  const lines = text.replace(/\n$/, '').split('\n').length;
  preview.textContent = text.split('\n').slice(0, 8).join('\n') + (lines > 8 ? '\n…' : '');
  rows(chosenRows, [
    ['nom', f.name], ['taille', fmtSize(f.size)], ['lignes', String(lines)],
    ['empreinte (SHA-256)', localHash ? localHash.slice(0, 16) + '…' : 'indisponible ici (page non sécurisée)'],
  ]);
  setStep(1, 'done', `texte UTF-8 · ${lines} ligne${lines > 1 ? 's' : ''}`);
  file = f;
  sendBtn.disabled = false;
}

async function check(f) {
  if (!/\.txt$/i.test(f.name)) return 'seuls les fichiers .txt sont acceptés';
  if (f.size < 1) return 'fichier vide';
  if (f.size > MAX_BYTES) return `trop gros (${fmtSize(f.size)}, max 20 Ko)`;
  const bytes = new Uint8Array(await f.arrayBuffer());
  if (bytes.includes(0)) return 'ce fichier n\'est pas du texte (octets nuls)';
  try { new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { return 'ce fichier n\'est pas de l\'UTF-8 valide'; }
  return null;
}

// ---- envoyer
sendBtn.addEventListener('click', async () => {
  const url = server.value.trim();
  if (!file || !url) { setStep(2, 'error', url ? 'aucun fichier' : 'pas d\'URL de serveur'); return; }
  sendBtn.disabled = true;
  receiptBox.hidden = true;
  setStep(2, 'active', 'envoi en cours…');
  setStep(3, 'pending');

  const t0 = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const body = new FormData();
    body.append('file', file);
    const res = await fetch(url, { method: 'POST', body, signal: ctrl.signal });
    const data = await res.json().catch(() => null);
    const ms = Math.round(performance.now() - t0);
    if (!res.ok || !data || !data.ok) {
      setStep(2, 'error', (data && data.error) || `réponse inattendue (HTTP ${res.status})`);
      return;
    }
    setStep(2, 'done', `reçu en ${ms} ms`);

    // l'empreinte calculée ici doit être celle que le serveur a calculée sur ce qu'il a reçu
    const same = localHash ? data.sha256 === localHash : null;
    setStep(3, same === false ? 'error' : 'done', same === null ? 'non vérifiable ici' : same ? 'empreinte identique ✓' : 'empreintes différentes ✗');
    rows(receiptRows, [
      ['rangé sous le nom', data.name],
      ['taille reçue', fmtSize(data.bytes)],
      ['lignes', String(data.lines)],
      ['empreinte serveur', data.sha256.slice(0, 16) + '…'],
      ['empreinte locale', localHash ? localHash.slice(0, 16) + '…' : 'indisponible'],
      ['verdict', same === null ? 'non vérifiable (page non sécurisée)' : same ? 'le fichier reçu est identique à l\'original ✓' : 'le fichier a été modifié en chemin ✗', same === false ? 'bad' : 'good'],
    ]);
    receiptBox.hidden = false;
    loadList(data.name);
  } catch (e) {
    setStep(2, 'error', e.name === 'AbortError' ? 'délai dépassé' : 'serveur injoignable (URL ? https ? dossier uploads/ ?)');
  } finally {
    clearTimeout(timer);
    sendBtn.disabled = !file;
  }
});

// ---- la liste des fichiers rangés sur le serveur
async function loadList(highlight) {
  const url = server.value.trim();
  if (!url) return;
  try {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'list=1', { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) throw new Error();
    list.replaceChildren();
    if (!data.files.length) {
      const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Aucun fichier pour l\'instant.';
      list.appendChild(li);
      return;
    }
    for (const f of data.files) {
      const li = document.createElement('li');
      if (f.name === highlight) li.className = 'new';
      const a = document.createElement('a');
      a.className = 'name'; a.textContent = f.name; a.target = '_blank'; a.rel = 'noopener';
      a.href = url + (url.includes('?') ? '&' : '?') + 'file=' + encodeURIComponent(f.name);
      const meta = document.createElement('span');
      meta.className = 'meta'; meta.textContent = `${fmtSize(f.size)} · ${new Date(f.time).toLocaleString('fr-FR')}`;
      const prev = document.createElement('span');
      prev.className = 'prev'; prev.textContent = f.preview;
      li.append(a, meta, prev);
      list.appendChild(li);
    }
  } catch (e) {
    list.replaceChildren();
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = 'Liste indisponible (serveur injoignable ou upload.php pas encore déposé).';
    list.appendChild(li);
  }
}
refresh.addEventListener('click', () => loadList());
loadList();
