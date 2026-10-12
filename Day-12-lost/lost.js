'use strict';

/* ============================================================
   Les moteurs. Chaque machine a une méthode step() qui renvoie
   { hl: [début, fin], out: 'texte', state: 'texte', done: bool }
   hl = les caractères du code à éclairer (index dans le texte saisi).
   Une machine peut lancer une Error (programme incorrect) : l'interface l'affiche.
   ============================================================ */

/* ---------- petit évaluateur d'expressions (COBOL et Plankalkül) ---------- */
function tokenize(s, hyphen) {
  const re = new RegExp('\\s*(?:("(?:[^"]|"")*"|\'[^\']*\')|(\\d+(?:\\.\\d+)?)|([A-Za-z][A-Za-z0-9' + (hyphen ? '-' : '') + ']*)|(>=|<=|<>|[-+*/()=<>,]))', 'y');
  const out = [];
  let pos = 0;
  s = s.replace(/\s+$/, '');
  while (pos < s.length) {
    re.lastIndex = pos;
    const m = re.exec(s);
    if (!m) throw new Error('caractère inattendu : « ' + s.slice(pos).trim().charAt(0) + ' »');
    pos = re.lastIndex;
    if (m[1] !== undefined) out.push({ k: 'str', v: m[1].slice(1, -1) });
    else if (m[2] !== undefined) out.push({ k: 'num', v: parseFloat(m[2]) });
    else if (m[3] !== undefined) out.push({ k: 'id', v: m[3].toUpperCase() });
    else out.push({ k: 'op', v: m[4] });
  }
  return out;
}

function evalCond(toks, get) {
  let i = 0;
  const peek = () => toks[i];
  const isOp = v => peek() && peek().k === 'op' && peek().v === v;
  const isWord = w => peek() && peek().k === 'id' && peek().v === w;
  const prim = () => {
    const t = toks[i++];
    if (t === undefined) throw new Error('expression incomplète');
    if (t.k === 'num' || t.k === 'str') return t.v;
    if (t.k === 'id') return get(t.v);
    if (t.v === '(') { const v = add(); if (!isOp(')')) throw new Error('parenthèse fermante manquante'); i++; return v; }
    if (t.v === '-') return -prim();
    throw new Error('symbole inattendu : ' + t.v);
  };
  const mul = () => { let v = prim(); while (isOp('*') || isOp('/')) { const o = toks[i++].v; const r = prim(); v = o === '*' ? v * r : v / r; } return v; };
  const add = () => { let v = mul(); while (isOp('+') || isOp('-')) { const o = toks[i++].v; const r = mul(); v = o === '+' ? v + r : v - r; } return v; };
  const cmp = () => {
    if (isWord('NOT')) { i++; return !cmp(); }
    const a = add();
    const t = peek();
    if (t && t.k === 'op' && ['=', '<', '>', '<=', '>=', '<>'].includes(t.v)) {
      i++;
      const b = add();
      switch (t.v) { case '=': return a == b; case '<': return a < b; case '>': return a > b; case '<=': return a <= b; case '>=': return a >= b; default: return a != b; } // eslint-disable-line eqeqeq
    }
    return a;
  };
  const and = () => { let v = cmp(); while (isWord('AND')) { i++; const r = cmp(); v = v && r; } return v; };
  const or = () => { let v = and(); while (isWord('OR')) { i++; const r = and(); v = v || r; } return v; };
  const v = or();
  if (i < toks.length) throw new Error('mot inattendu : ' + toks[i].v);
  return v;
}

/* position de chaque ligne dans le texte, pour éclairer une ligne entière */
function lineRanges(src) {
  const r = [];
  let off = 0;
  for (const l of src.split('\n')) { r.push(l.length ? [off, off + l.length - 1] : null); off += l.length + 1; }
  return r;
}

/* ---------- Brainfuck ---------- */
function makeBrainfuck(code) {
  const jump = {};
  const open = [];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '[') open.push(i);
    else if (code[i] === ']') {
      if (!open.length) throw new Error('« ] » sans « [ » (position ' + i + ')');
      const j = open.pop(); jump[i] = j; jump[j] = i;
    }
  }
  if (open.length) throw new Error('« [ » jamais refermé (position ' + open[0] + ')');
  const tape = new Uint8Array(512);
  let p = 0, ip = 0;
  const show = () => {
    const cells = [];
    for (let k = 0; k < 10; k++) cells.push(k === p ? '[' + tape[k] + ']' : String(tape[k]));
    return 'bande : ' + cells.join(' ') + ' …   (case ' + p + ')';
  };
  return {
    step() {
      while (ip < code.length && '+-<>[].,'.indexOf(code[ip]) < 0) ip++;
      if (ip >= code.length) return { done: true, state: show() };
      const i = ip, c = code[i];
      let out = '';
      if (c === '+') tape[p]++;
      else if (c === '-') tape[p]--;
      else if (c === '>') p = (p + 1) % 512;
      else if (c === '<') p = (p + 511) % 512;
      else if (c === '[') { if (!tape[p]) ip = jump[i]; }
      else if (c === ']') { if (tape[p]) ip = jump[i]; }
      else if (c === '.') out = String.fromCharCode(tape[p]);
      ip++;
      return { hl: [i, i], out, state: show() };
    }
  };
}

/* ---------- Befunge-93 ---------- */
function makeBefunge(src) {
  const lines = src.split('\n');
  const starts = [];
  let off = 0;
  for (const l of lines) { starts.push(off); off += l.length + 1; }
  const w = Math.max(1, ...lines.map(l => l.length));
  const h = lines.length;
  if (w > 80 || h > 25) throw new Error('la grille dépasse 80 colonnes × 25 lignes');
  const g = lines.map(l => l.padEnd(w, ' ').split(''));
  let x = 0, y = 0, dx = 1, dy = 0, str = false;
  const s = [];
  const pop = () => (s.length ? s.pop() : 0);
  const move = () => { x = (x + dx + w) % w; y = (y + dy + h) % h; };
  const show = () => 'pile : [' + s.join(', ') + ']   direction : ' + ({ '1,0': '→', '-1,0': '←', '0,1': '↓', '0,-1': '↑' })[dx + ',' + dy];
  return {
    step() {
      const c = g[y][x];
      const hl = x < lines[y].length ? [starts[y] + x, starts[y] + x] : null;
      let out = '', done = false;
      if (str) {
        if (c === '"') str = false; else s.push(c.charCodeAt(0));
      } else if (c >= '0' && c <= '9') s.push(+c);
      else switch (c) {
        case '+': s.push(pop() + pop()); break;
        case '-': { const a = pop(), b = pop(); s.push(b - a); break; }
        case '*': s.push(pop() * pop()); break;
        case '/': { const a = pop(), b = pop(); s.push(a ? Math.floor(b / a) : 0); break; }
        case '%': { const a = pop(), b = pop(); s.push(a ? b % a : 0); break; }
        case '!': s.push(pop() ? 0 : 1); break;
        case '`': { const a = pop(), b = pop(); s.push(b > a ? 1 : 0); break; }
        case '>': dx = 1; dy = 0; break;
        case '<': dx = -1; dy = 0; break;
        case '^': dx = 0; dy = -1; break;
        case 'v': dx = 0; dy = 1; break;
        case '?': { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)]; dx = d[0]; dy = d[1]; break; }
        case '_': if (pop()) { dx = -1; dy = 0; } else { dx = 1; dy = 0; } break;
        case '|': if (pop()) { dx = 0; dy = -1; } else { dx = 0; dy = 1; } break;
        case '"': str = true; break;
        case ':': { const a = pop(); s.push(a, a); break; }
        case '\\': { const a = pop(), b = pop(); s.push(a, b); break; }
        case '$': pop(); break;
        case '.': out = pop() + ' '; break;
        case ',': out = String.fromCharCode(pop()); break;
        case '#': move(); break;
        case 'g': { const yy = pop(), xx = pop(); s.push(g[yy] && g[yy][xx] ? g[yy][xx].charCodeAt(0) : 32); break; }
        case 'p': { const yy = pop(), xx = pop(), v = pop(); if (g[yy] && xx >= 0 && xx < w) g[yy][xx] = String.fromCharCode(v); break; }
        case '@': done = true; break;
        default: break; // espace ou caractère inconnu : on avance
      }
      if (!done) move();
      return { hl, out, state: show(), done };
    }
  };
}

/* ---------- Whitespace ---------- */
const WS = { S: ' ', T: '\t', L: '\n' };
const WS_OPS = {
  push: 'SS', dup: 'SLS', swap: 'SLT', pop: 'SLL', add: 'TSSS', sub: 'TSST', mul: 'TSSL',
  outc: 'TLSS', outn: 'TLST', label: 'LSS', jmp: 'LSL', jz: 'LTS', end: 'LLL'
};
function wsNumber(n) {
  const bits = Math.abs(n).toString(2);
  return (n < 0 ? 'T' : 'S') + bits.replace(/0/g, 'S').replace(/1/g, 'T') + 'L';
}
function wsLabel(n) { return n.toString(2).replace(/0/g, 'S').replace(/1/g, 'T') + 'L'; }
/* assembleur : sert uniquement à écrire l'exemple, en vrai texte Whitespace */
function wsAssemble(prog) {
  let out = '';
  for (const [op, arg] of prog) {
    let t = WS_OPS[op];
    if (op === 'push') t += wsNumber(arg);
    else if (op === 'label' || op === 'jmp' || op === 'jz') t += wsLabel(arg);
    out += t;
  }
  return out.replace(/[STL]/g, c => WS[c]);
}
/* version lisible : · espace, ⇥ tabulation, ↵ retour à la ligne */
function wsVisible(raw) { return raw.replace(/ /g, '·').replace(/\t/g, '⇥').replace(/\n/g, '↵\n'); }

/* Le texte saisi : s'il contient · ⇥ ↵ (ou . → ), seuls ces symboles comptent ; sinon ce sont les vrais espaces, tabulations et retours. */
function wsStream(src) {
  const glyph = /[·⇥↵→]/.test(src);
  const chars = [], idx = [];
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    let v = null;
    if (glyph) v = c === '·' ? ' ' : (c === '⇥' || c === '→') ? '\t' : c === '↵' ? '\n' : null;
    else if (c === ' ' || c === '\t' || c === '\n') v = c;
    if (v !== null) { chars.push(v); idx.push(k); }
  }
  return { s: chars.join(''), idx };
}
function wsParse(s) {
  let i = 0;
  const ins = [];
  const need = () => { if (i >= s.length) throw new Error('programme incomplet : une instruction est coupée'); };
  const number = () => {
    need();
    const sign = s[i++] === '\t' ? -1 : 1;
    let n = 0;
    while (s[i] !== '\n') { need(); n = n * 2 + (s[i++] === '\t' ? 1 : 0); }
    i++;
    return sign * n;
  };
  const label = () => { let k = ''; while (s[i] !== '\n') { need(); k += s[i++]; } i++; return k; };
  const nx = () => { need(); return s[i++]; };
  const T = '\t', S = ' ', L = '\n';
  while (i < s.length) {
    const from = i;
    const a = nx(), b = nx();
    let op;
    if (a === S && b === S) op = { op: 'push', arg: number() };
    else if (a === S && b === T) { const c = nx(); if (c === T) throw new Error('instruction inconnue'); op = { op: c === S ? 'copy' : 'slide', arg: number() }; }
    else if (a === S && b === L) { const c = nx(); op = { op: c === S ? 'dup' : c === T ? 'swap' : 'pop' }; }
    else if (a === T && b === S) {
      const c = nx(), d = nx();
      const k = { SS: 'add', ST: 'sub', SL: 'mul', TS: 'div', TT: 'mod' }[(c === S ? 'S' : c === T ? 'T' : 'L') + (d === S ? 'S' : d === T ? 'T' : 'L')];
      if (!k) throw new Error('instruction arithmétique inconnue');
      op = { op: k };
    }
    else if (a === T && b === T) { const c = nx(); if (c === L) throw new Error('instruction inconnue'); op = { op: c === S ? 'store' : 'load' }; }
    else if (a === T && b === L) {
      const c = nx(), d = nx();
      if (c === S && d === S) op = { op: 'outc' };
      else if (c === S && d === T) op = { op: 'outn' };
      else throw new Error('la lecture au clavier n’est pas gérée dans cette page');
    }
    else if (a === L && b === S) { const c = nx(); op = { op: c === S ? 'label' : c === T ? 'call' : 'jmp', arg: label() }; }
    else if (a === L && b === T) { const c = nx(); op = { op: c === S ? 'jz' : c === T ? 'jneg' : 'ret' }; if (c !== L) op.arg = label(); }
    else { const c = nx(); if (c !== L) throw new Error('instruction inconnue'); op = { op: 'end' }; }
    op.from = from; op.to = i - 1;
    ins.push(op);
  }
  return ins;
}
function makeWhitespace(src) {
  const { s, idx } = wsStream(src);
  const ins = wsParse(s);
  const labels = {};
  ins.forEach((o, k) => { if (o.op === 'label') labels[o.arg] = k; });
  for (const o of ins) if (['jmp', 'jz', 'jneg', 'call'].includes(o.op) && !(o.arg in labels)) throw new Error('saut vers une étiquette qui n’existe pas');
  const st = [], calls = [], heap = {};
  const pop = () => { if (!st.length) throw new Error('la pile est vide'); return st.pop(); };
  let pc = 0;
  const names = { push: 'empiler', dup: 'dupliquer', swap: 'échanger', pop: 'défausser', add: 'additionner', sub: 'soustraire', mul: 'multiplier', div: 'diviser', mod: 'reste', outc: 'afficher caractère', outn: 'afficher nombre', label: 'étiquette', jmp: 'sauter', jz: 'sauter si zéro', jneg: 'sauter si négatif', call: 'appeler', ret: 'retour', end: 'fin', copy: 'copier', slide: 'glisser', store: 'ranger', load: 'lire' };
  return {
    step() {
      if (pc >= ins.length) return { done: true };
      const o = ins[pc++];
      let out = '', done = false;
      switch (o.op) {
        case 'push': st.push(o.arg); break;
        case 'dup': { const a = pop(); st.push(a, a); break; }
        case 'swap': { const a = pop(), b = pop(); st.push(a, b); break; }
        case 'pop': pop(); break;
        case 'copy': { const v = st[st.length - 1 - o.arg]; if (v === undefined) throw new Error('la pile est trop courte'); st.push(v); break; }
        case 'slide': { const t = pop(); st.length = Math.max(0, st.length - o.arg); st.push(t); break; }
        case 'add': { const a = pop(), b = pop(); st.push(b + a); break; }
        case 'sub': { const a = pop(), b = pop(); st.push(b - a); break; }
        case 'mul': { const a = pop(), b = pop(); st.push(b * a); break; }
        case 'div': { const a = pop(), b = pop(); if (!a) throw new Error('division par zéro'); st.push(Math.floor(b / a)); break; }
        case 'mod': { const a = pop(), b = pop(); if (!a) throw new Error('division par zéro'); st.push(((b % a) + a) % a); break; }
        case 'store': { const v = pop(), a = pop(); heap[a] = v; break; }
        case 'load': { const a = pop(); st.push(heap[a] || 0); break; }
        case 'outc': out = String.fromCharCode(pop()); break;
        case 'outn': out = String(pop()); break;
        case 'jmp': pc = labels[o.arg]; break;
        case 'jz': if (pop() === 0) pc = labels[o.arg]; break;
        case 'jneg': if (pop() < 0) pc = labels[o.arg]; break;
        case 'call': calls.push(pc); pc = labels[o.arg]; break;
        case 'ret': if (!calls.length) throw new Error('retour sans appel'); pc = calls.pop(); break;
        case 'end': done = true; break;
        default: break;
      }
      return { hl: [idx[o.from], idx[o.to]], out, state: 'pile : [' + st.join(', ') + ']   instruction : ' + names[o.op] + (o.op === 'push' ? ' ' + o.arg : ''), done };
    }
  };
}

/* ---------- Malbolge ---------- */
const MB_CRAZY = [1, 0, 0, 1, 0, 2, 2, 2, 1];
const MB_XLAT = '5z]&gqtyfr$(we4{WP)H-Zn,[%\\3dL+Q;>U!pJS72FhOA1CB6v^=I_0/8|jsb9m<.TVac`uY*MK\'X~xDl}REokN:#?G"i@';
const MB_OPS = [4, 5, 23, 39, 40, 62, 68, 81];
function mbCrazy(a, b) {
  let r = 0, m = 1;
  for (let i = 0; i < 10; i++) {
    r += MB_CRAZY[(a % 3) * 3 + (b % 3)] * m;
    a = Math.floor(a / 3); b = Math.floor(b / 3); m *= 3;
  }
  return r;
}
function makeMalbolge(src) {
  const mem = new Array(59049);
  const idx = [];
  let n = 0;
  for (let k = 0; k < src.length; k++) {
    const ch = src[k];
    if (/\s/.test(ch)) continue;
    const v = ch.charCodeAt(0);
    if (v < 33 || v > 126) throw new Error('caractère interdit : « ' + ch + ' » (Malbolge n’accepte que les caractères ASCII imprimables)');
    if (!MB_OPS.includes((v + n) % 94)) throw new Error('le caractère « ' + ch + ' » en position ' + n + ' n’est pas une instruction valide à cet endroit');
    mem[n] = v; idx.push(k); n++;
  }
  const len = n;
  if (!len) throw new Error('programme vide');
  for (; n < 59049; n++) mem[n] = mbCrazy(mem[n - 1], mem[n - 2]);
  let a = 0, c = 0, d = 0;
  const NAMES = { 4: 'saut', 5: 'écrire A', 23: 'lire', 39: 'rotation', 40: 'déplacer D', 62: 'opération folle', 68: 'rien', 81: 'fin' };
  return {
    step() {
      const v = mem[c];
      if (v < 33 || v > 126) return { done: true };
      const at = c;
      const op = (v + c) % 94;
      let out = '', done = false;
      if (op === 4) c = mem[d];
      else if (op === 5) out = String.fromCharCode(a % 256);
      else if (op === 23) a = 0;
      else if (op === 39) a = mem[d] = Math.floor(mem[d] / 3) + (mem[d] % 3) * 19683;
      else if (op === 40) d = mem[d];
      else if (op === 62) a = mem[d] = mbCrazy(a, mem[d]);
      else if (op === 81) done = true;
      if (!done) {
        if (mem[c] >= 33 && mem[c] <= 126) mem[c] = MB_XLAT.charCodeAt(mem[c] - 33);
        c = (c + 1) % 59049; d = (d + 1) % 59049;
      }
      const hl = at < len ? [idx[at], idx[at]] : null;
      return { hl, out, done, state: 'A = ' + a + '   C = ' + c + '   D = ' + d + '   instruction : ' + (NAMES[op] || 'rien') };
    }
  };
}

/* ---------- COBOL (sous-ensemble) ---------- */
function makeCobol(src) {
  const rawLines = src.split('\n');
  const ranges = lineRanges(src);
  const ins = [];
  const stack = [];
  const fail = (n, msg) => { throw new Error('ligne ' + (n + 1) + ' : ' + msg); };

  rawLines.forEach((raw, n) => {
    let t = raw.replace(/^\s*\d{6}(?=\s|$)/, '').trim();
    if (!t || t[0] === '*') return;
    t = t.replace(/\.$/, '').trim();
    if (!t) return;
    const up = t.toUpperCase();
    const first = up.split(/\s+/)[0].replace(/\.$/, '');
    const add = o => { o.line = n; ins.push(o); return ins.length - 1; };
    const toks = () => { try { return tokenize(t, true); } catch (e) { return fail(n, e.message); } };

    if (['IDENTIFICATION', 'ENVIRONMENT', 'DATA', 'PROCEDURE', 'WORKING-STORAGE', 'PROGRAM-ID', 'AUTHOR', 'FILE', 'LOCAL-STORAGE'].includes(first)) { add({ k: 'nop' }); return; }
    if (/^\d+$/.test(first)) {
      const m = /^(\d+)\s+([A-Z0-9-]+)\s+PIC(?:TURE)?\s+(?:IS\s+)?([9X]+)(?:\((\d+)\))?(?:\s+VALUE\s+(?:IS\s+)?(.+))?$/i.exec(t);
      if (!m) fail(n, 'déclaration non gérée (PIC 9 ou PIC X attendu)');
      const type = m[3][0].toUpperCase();
      const size = m[4] ? parseInt(m[4], 10) : m[3].length;
      let val = type === '9' ? 0 : '';
      if (m[5]) { const vt = tokenize(m[5], true)[0]; val = vt.v; }
      add({ k: 'data', name: m[2].toUpperCase(), type, size, val });
      return;
    }
    const T = toks();
    const idxOf = w => T.findIndex(x => x.k === 'id' && x.v === w);
    const sub = (a, b) => T.slice(a, b);
    if (first === 'DISPLAY') add({ k: 'display', items: T.slice(1) });
    else if (first === 'MOVE') { const i = idxOf('TO'); if (i < 0) fail(n, 'MOVE … TO … attendu'); add({ k: 'move', e: sub(1, i), to: sub(i + 1).filter(x => x.k === 'id').map(x => x.v) }); }
    else if (first === 'ADD') { const i = idxOf('TO'); if (i < 0) fail(n, 'ADD … TO … attendu'); add({ k: 'arith', op: '+', e: sub(1, i), to: sub(i + 1).filter(x => x.k === 'id').map(x => x.v) }); }
    else if (first === 'SUBTRACT') { const i = idxOf('FROM'); if (i < 0) fail(n, 'SUBTRACT … FROM … attendu'); add({ k: 'arith', op: '-', e: sub(1, i), to: sub(i + 1).filter(x => x.k === 'id').map(x => x.v) }); }
    else if (first === 'MULTIPLY') { const i = idxOf('BY'); if (i < 0) fail(n, 'MULTIPLY … BY … attendu'); add({ k: 'arith', op: '*', e: sub(1, i), to: sub(i + 1).filter(x => x.k === 'id').map(x => x.v) }); }
    else if (first === 'COMPUTE') { const i = T.findIndex(x => x.k === 'op' && x.v === '='); if (i !== 2 || T[1].k !== 'id') fail(n, 'COMPUTE NOM = expression attendu'); add({ k: 'move', e: T.slice(3), to: [T[1].v] }); }
    else if (first === 'IF') { let c = T.slice(1); if (c.length && c[c.length - 1].v === 'THEN') c = c.slice(0, -1); stack.push({ t: 'if', p: add({ k: 'if', cond: c, else: null }) }); }
    else if (first === 'ELSE') {
      const top = stack[stack.length - 1];
      if (!top || top.t !== 'if' || top.j !== undefined) fail(n, 'ELSE sans IF');
      top.j = add({ k: 'jmp', to: null });
    }
    else if (first === 'END-IF') {
      const top = stack.pop();
      if (!top || top.t !== 'if') fail(n, 'END-IF sans IF');
      if (top.j !== undefined) { ins[top.j].to = ins.length; ins[top.p].else = top.j + 1; } else ins[top.p].else = ins.length;
    }
    else if (first === 'PERFORM') {
      if (idxOf('VARYING') === 1) {
        const f = idxOf('FROM'), b = idxOf('BY'), u = idxOf('UNTIL');
        if (f < 0 || b < 0 || u < 0) fail(n, 'PERFORM VARYING v FROM a BY b UNTIL condition attendu');
        const init = add({ k: 'move', e: sub(f + 1, b), to: [T[2].v] });
        const test = add({ k: 'until', cond: sub(u + 1), end: null });
        stack.push({ t: 'vary', test, v: T[2].v, by: sub(b + 1, u), init });
      } else if (idxOf('UNTIL') === 1) {
        stack.push({ t: 'until', test: add({ k: 'until', cond: T.slice(2), end: null }) });
      } else if (T[T.length - 1].v === 'TIMES') {
        const tmp = '$T' + ins.length;
        add({ k: 'times_init', tmp, e: T.slice(1, -1) });
        stack.push({ t: 'times', tmp, test: add({ k: 'times_test', tmp, end: null }) });
      } else fail(n, 'PERFORM non géré (UNTIL, n TIMES ou VARYING)');
    }
    else if (first === 'END-PERFORM') {
      const top = stack.pop();
      if (!top || !['until', 'vary', 'times'].includes(top.t)) fail(n, 'END-PERFORM sans PERFORM');
      if (top.t === 'times') add({ k: 'times_next', tmp: top.tmp, to: top.test });
      else if (top.t === 'vary') add({ k: 'vary_next', v: top.v, by: top.by, to: top.test });
      else add({ k: 'jmp', to: top.test });
      ins[top.test].end = ins.length;
    }
    else if (first === 'STOP' || first === 'GOBACK') add({ k: 'stop' });
    else fail(n, 'instruction non reconnue : ' + first + ' (voir le sous-ensemble géré dans le README)');
  });
  if (stack.length) throw new Error('un bloc (IF ou PERFORM) n’est jamais refermé');

  const vars = {};
  let pc = 0;
  const get = name => {
    if (name in vars) return vars[name].v;
    throw new Error('variable inconnue : ' + name);
  };
  const setv = (name, val) => {
    if (!(name in vars)) throw new Error('variable inconnue : ' + name);
    const d = vars[name];
    if (d.type === '9') d.v = Math.abs(Math.trunc(Number(val))) % Math.pow(10, d.size);
    else d.v = String(val).slice(0, d.size);
  };
  const shown = name => { const d = vars[name]; return d.type === '9' ? String(d.v).padStart(d.size, '0') : d.v.padEnd(d.size, ' '); };
  const stateText = () => { const k = Object.keys(vars).filter(x => x[0] !== '$'); return k.length ? k.map(x => x + ' = ' + shown(x)).join('   ') : 'aucune variable'; };
  const num = toks => Number(evalCond(toks, get));
  return {
    step() {
      if (pc >= ins.length) return { done: true, state: stateText() };
      const o = ins[pc];
      pc++;
      let out = '', done = false;
      try {
        switch (o.k) {
          case 'data': vars[o.name] = { type: o.type, size: o.size, v: 0 }; setv(o.name, o.val); break;
          case 'display': out = o.items.map(t => { if (t.k !== 'id') return t.v; get(t.v); return shown(t.v); }).join('') + '\n'; break;
          case 'move': for (const nm of o.to) setv(nm, evalCond(o.e, get)); break;
          case 'arith': for (const nm of o.to) { const a = num(o.e), b = Number(get(nm)); setv(nm, o.op === '+' ? b + a : o.op === '-' ? b - a : b * a); } break;
          case 'if': if (!evalCond(o.cond, get)) pc = o.else; break;
          case 'jmp': pc = o.to; break;
          case 'until': if (evalCond(o.cond, get)) pc = o.end; break;
          case 'times_init': vars[o.tmp] = { type: '9', size: 9, v: 0 }; setv(o.tmp, num(o.e)); break;
          case 'times_test': if (get(o.tmp) <= 0) pc = o.end; break;
          case 'times_next': setv(o.tmp, get(o.tmp) - 1); pc = o.to; break;
          case 'vary_next': setv(o.v, Number(get(o.v)) + num(o.by)); pc = o.to; break;
          case 'stop': done = true; break;
          default: break;
        }
      } catch (e) { throw new Error('ligne ' + (o.line + 1) + ' : ' + e.message); }
      return { hl: ranges[o.line], out, state: stateText(), done };
    }
  };
}

/* ---------- Plankalkül (dialecte reconstitué, sous-ensemble) ---------- */
function makePlankalkul(src) {
  const rawLines = src.split('\n');
  const ranges = lineRanges(src);
  const ins = [];
  const stack = [];
  const fail = (n, msg) => { throw new Error('ligne ' + (n + 1) + ' : ' + msg); };
  const close = (indent, n) => {
    while (stack.length && stack[stack.length - 1].indent >= indent) {
      const top = stack.pop();
      if (top.t === 'W') ins.push({ k: 'jmp', to: top.p, line: top.line });
      ins[top.p].end = ins.length;
    }
  };
  rawLines.forEach((raw, n) => {
    const line = raw.replace(/\t/g, '    ').replace(/⇒|→|->/g, '=>');
    if (!line.trim() || line.trim()[0] === '#') return;
    const indent = line.length - line.trimStart().length;
    const t = line.trim();
    close(indent, n);
    const add = o => { o.line = n; ins.push(o); return ins.length - 1; };
    let m;
    if (/^P\d+(\s|$)/i.test(t)) { add({ k: 'nop' }); return; }
    if ((m = /^(W|Wenn)\s*\((.*)\)\s*$/i.exec(t))) {
      let c;
      try { c = tokenize(m[2], false); } catch (e) { fail(n, e.message); }
      const isW = m[1].toUpperCase() === 'W' && m[1] !== 'Wenn';
      stack.push({ t: isW ? 'W' : 'Wenn', indent, line: n, p: add({ k: 'test', cond: c, end: null }) });
      return;
    }
    const parts = t.split('=>');
    if (parts.length === 2) {
      const target = parts[1].trim().toUpperCase();
      if (!/^[VZR]\d+$/.test(target)) fail(n, 'le nom de variable doit être V, Z ou R suivi d’un nombre (ex. Z0)');
      let e;
      try { e = tokenize(parts[0], false); } catch (er) { fail(n, er.message); }
      add({ k: 'assign', e, to: target });
      return;
    }
    fail(n, 'instruction non reconnue (attendu : expression => variable, W (condition) ou Wenn (condition))');
  });
  close(-1, rawLines.length);

  const vars = {};
  let pc = 0, finished = false;
  const get = name => { if (!(name in vars)) throw new Error('variable pas encore définie : ' + name); return vars[name]; };
  const stateText = () => { const k = Object.keys(vars); return k.length ? k.map(x => x + ' = ' + vars[x]).join('   ') : 'aucune variable'; };
  return {
    step() {
      if (finished) return { done: true };
      if (pc >= ins.length) {
        finished = true;
        const rs = Object.keys(vars).filter(x => x[0] === 'R').sort();
        return { out: rs.map(r => r + ' = ' + vars[r] + '\n').join(''), state: stateText(), done: true };
      }
      const o = ins[pc++];
      try {
        if (o.k === 'assign') vars[o.to] = evalCond(o.e, get);
        else if (o.k === 'test') { if (!evalCond(o.cond, get)) pc = o.end; }
        else if (o.k === 'jmp') pc = o.to;
      } catch (e) { throw new Error('ligne ' + (o.line + 1) + ' : ' + e.message); }
      return { hl: ranges[o.line], state: stateText() };
    }
  };
}

/* ============================================================
   Les six langages et leurs programmes d'exemple
   ============================================================ */
const BF_HELLO = '++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.>++.';

const BEFUNGE_SRC = [
  '>"!tsol ,olleH"v',
  'v              <',
  '>:#,_@'
].join('\n');

const WS_SRC = wsVisible(wsAssemble([
  ['push', 76], ['outc'], ['push', 79], ['outc'], ['push', 83], ['outc'], ['push', 84], ['outc'], ['push', 10], ['outc'],
  ['push', 3],
  ['label', 1],
  ['dup'], ['outn'], ['push', 10], ['outc'],
  ['push', 1], ['sub'],
  ['dup'], ['jz', 2],
  ['jmp', 1],
  ['label', 2],
  ['pop'], ['end']
]));

const MALBOLGE_SRC = ">=<;:9876543210/.-,+*)('&%$#\"!~}|{zyxwvutsrqponmlkjihgfeMcba`_^]\\[Z_^]\\[ZYXWPtNMLKJIHGFEDCBA@?>=<;:98~6543810/S3,+0)(',%$#G!~}|{zyxwvutsrqponmlkjihgfNdiba`_^]\\[ZYX]VUZYXWPta";

const PLANK_SRC = [
  'P1  Somme',
  '    4 => V0',
  '    0 => Z0',
  '    1 => Z1',
  '    W (Z1 <= V0)',
  '        Z0 + Z1 => Z0',
  '        Z1 + 1 => Z1',
  '    Z0 => R0'
].join('\n');

const COBOL_SRC = [
  '000100 IDENTIFICATION DIVISION.',
  '000200 PROGRAM-ID. PERDU.',
  '000300 DATA DIVISION.',
  '000400 WORKING-STORAGE SECTION.',
  '000500 01 COMPTEUR PIC 9 VALUE 3.',
  '000600 PROCEDURE DIVISION.',
  '000700     PERFORM UNTIL COMPTEUR = 0',
  '000800         DISPLAY "IL RESTE " COMPTEUR',
  '000900         SUBTRACT 1 FROM COMPTEUR',
  '001000     END-PERFORM.',
  '001100     DISPLAY "RETROUVE.".',
  '001200     STOP RUN.'
].join('\n');

const LANGS = [
  {
    id: 'plankalkul', name: 'Plankalkül', year: 1945, by: 'Konrad Zuse', speed: 3,
    why: "Zuse l'imagine sur le papier pendant la guerre, pour une machine qui n'a jamais pu l'exécuter. Il n'est implémenté qu'en 1975, trente ans plus tard : le premier langage de haut niveau était perdu avant d'exister.",
    note: "Dialecte reconstitué : Zuse écrivait sur trois lignes superposées (variables, indices, types), ici tout tient sur une ligne. Gère expression => variable (V, Z ou R + numéro), W (condition) pour répéter et Wenn (condition) pour choisir, avec des blocs décalés. Les variables R sont affichées à la fin.",
    code: PLANK_SRC, make: makePlankalkul
  },
  {
    id: 'cobol', name: 'COBOL', year: 1959, by: 'CODASYL', speed: 3,
    why: "Il fait encore tourner une grande partie des banques et des administrations, mais ceux qui savent le lire partent à la retraite. Il n'est pas mort : il est en train de se perdre.",
    note: "Sous-ensemble : DISPLAY, MOVE, ADD … TO, SUBTRACT … FROM, MULTIPLY … BY, COMPUTE, IF / ELSE / END-IF, PERFORM UNTIL, PERFORM n TIMES, PERFORM VARYING, STOP RUN, avec PIC 9 et PIC X. Les numéros de ligne à six chiffres sont facultatifs.",
    code: COBOL_SRC, make: makeCobol
  },
  {
    id: 'brainfuck', name: 'Brainfuck', year: 1993, by: 'Urban Müller', speed: 90,
    why: "Huit instructions, un ruban de cases et rien d'autre. Conçu pour avoir le plus petit compilateur possible, personne ne l'utilise pour travailler : on s'y perd, c'est le but.",
    note: "Les huit instructions + - < > [ ] . , (la lecture , donne 0). Tout autre caractère est un commentaire. L'exemple est le « Hello World » classique.",
    code: BF_HELLO, make: makeBrainfuck
  },
  {
    id: 'befunge', name: 'Befunge', year: 1993, by: 'Chris Pressey', speed: 14,
    why: "Le code est une grille et le pointeur peut partir dans n'importe quelle direction, sortir par un bord et revenir par l'autre. Le programme se promène : il peut se perdre. Il a été pensé pour être aussi difficile que possible à compiler.",
    note: "Befunge-93 (grille de 80 × 25 au plus, pile, 4 directions, bords qui se rejoignent). Seules les entrées & et ~ manquent.",
    code: BEFUNGE_SRC, make: makeBefunge
  },
  {
    id: 'whitespace', name: 'Whitespace', year: 2003, by: 'Edwin Brady et Chris Morris', speed: 8, ws: true,
    why: "Le code est invisible : seuls l'espace, la tabulation et le retour à la ligne comptent. Tout le reste est un commentaire. Un programme Whitespace imprimé ressemble à une page blanche.",
    note: "Pour le rendre visible, · = espace, ⇥ = tabulation, ↵ = retour à la ligne (les boutons les insèrent). Si le texte ne contient aucun de ces symboles, ce sont les vrais espaces, tabulations et retours qui comptent. Tout est géré sauf la lecture au clavier.",
    code: WS_SRC, make: makeWhitespace
  },
  {
    id: 'malbolge', name: 'Malbolge', year: 1998, by: 'Ben Olmstead', speed: 14,
    why: "Conçu pour être impossible à programmer : chaque instruction se brouille après avoir été lue. Le premier programme n'est apparu que deux ans après sa sortie, et il a été trouvé par une recherche automatique, pas écrit à la main. Celui-ci aussi.",
    note: "Interpréteur complet (sauf la lecture au clavier). Chaque caractère doit être une instruction valide à sa position, sinon la page le signale. L'exemple a été trouvé par une recherche (voir le README) et affiche « Lost ».",
    code: MALBOLGE_SRC, make: makeMalbolge
  }
];

if (typeof module !== 'undefined') module.exports = { LANGS };

/* ============================================================
   L'interface
   ============================================================ */
if (typeof document !== 'undefined') (function () {
  const $ = id => document.getElementById(id);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const els = {
    list: $('list'), count: $('count'), pips: $('pips'),
    name: $('l-name'), meta: $('l-meta'), why: $('l-why'), note: $('l-note'),
    ed: $('ed'), hl: $('hl'), inserts: $('inserts'), state: $('state'), out: $('out'), err: $('err'), status: $('status'),
    run: $('run'), step: $('step'), reset: $('reset'), restore: $('restore'), speed: $('speed'), speedv: $('speedv')
  };
  const MAX_STEPS = 3000000, MAX_OUT = 20000;

  let cur = null, mach = null, spans = [], running = false, ready = false, raf = 0, last = 0, acc = 0, steps = 0, lastHl = null, dead = false;
  const found = new Set();

  /* liste des langages */
  const buttons = LANGS.map(l => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'lang';
    b.innerHTML = '<span class="n"></span><span class="y"></span><span class="s"></span>';
    b.querySelector('.n').textContent = l.name;
    b.querySelector('.y').textContent = l.year;
    b.addEventListener('click', () => select(l));
    li.appendChild(b);
    els.list.appendChild(li);
    return b;
  });
  const pips = LANGS.map(() => { const p = document.createElement('i'); els.pips.appendChild(p); return p; });

  function refreshList() {
    LANGS.forEach((l, k) => {
      const b = buttons[k];
      const isFound = found.has(l.id);
      b.classList.toggle('found', isFound);
      b.classList.toggle('active', l === cur);
      b.setAttribute('aria-current', l === cur ? 'true' : 'false');
      b.querySelector('.s').textContent = isFound ? 'retrouvé' : 'perdu';
      pips[k].classList.toggle('on', isFound);
    });
    els.count.textContent = found.size + ' / ' + LANGS.length;
  }

  const say = t => { els.status.textContent = t; };
  function stopLoop() { running = false; cancelAnimationFrame(raf); els.run.textContent = 'Exécuter'; }
  function showError(msg) { els.err.textContent = 'Erreur : ' + msg; els.err.hidden = false; }

  /* calque d'éclairage derrière la zone de saisie */
  function paint() {
    const text = els.ed.value;
    els.hl.textContent = '';
    spans = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < text.length; i++) {
      const s = document.createElement('span');
      s.textContent = text[i];
      frag.appendChild(s);
      spans.push(s);
    }
    els.hl.appendChild(frag);
    els.hl.appendChild(document.createTextNode('\n'));
    lastHl = null;
  }
  els.ed.addEventListener('scroll', () => { els.hl.scrollTop = els.ed.scrollTop; els.hl.scrollLeft = els.ed.scrollLeft; });

  /* « fouille » : le code se déchiffre de gauche à droite */
  const NOISE = '▒░▓█▚▞#%&?¤§';
  function unearth(done) {
    const n = spans.length;
    if (reduce || !n) { done(); return; }
    const t0 = performance.now();
    const dur = Math.min(1600, 500 + n * 8);
    const mine = cur;
    const tick = now => {
      if (cur !== mine) return;
      const p = Math.min(1, (now - t0) / dur);
      const upto = Math.floor(p * n);
      for (let i = 0; i < n; i++) {
        const real = els.ed.value[i];
        spans[i].textContent = i < upto || /\s/.test(real) || real === '↵' ? real : NOISE[(i * 7 + Math.floor(now / 70)) % NOISE.length];
      }
      if (p < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  }

  function select(lang) {
    stopLoop();
    cur = lang;
    ready = false;
    els.name.textContent = lang.name;
    els.meta.textContent = lang.year + ' · ' + lang.by;
    els.why.textContent = lang.why;
    els.note.textContent = lang.note;
    els.inserts.hidden = !lang.ws;
    els.speed.value = Math.log10(lang.speed).toFixed(2);
    updateSpeed();
    els.ed.value = lang.code;
    els.ed.readOnly = true;
    paint();
    refreshList();
    clearRun();
    setButtons(false);
    say('Fouille en cours…');
    unearth(() => {
      paint();
      els.ed.readOnly = false;
      ready = true;
      setButtons(true);
      say(lang.name + ' est déterré. Tu peux modifier le code, puis l’exécuter.');
    });
  }

  function setButtons(on) { els.run.disabled = !on; els.step.disabled = !on; els.reset.disabled = !on; els.restore.disabled = !on; }

  function clearRun() {
    mach = null; steps = 0; acc = 0; dead = false;
    spans.forEach(s => s.classList.remove('on', 'seen'));
    lastHl = null;
    els.out.textContent = '';
    els.state.textContent = '—';
    els.err.hidden = true;
  }

  /* repart de zéro avec le code actuel de la zone de saisie */
  function build() {
    clearRun();
    try {
      mach = cur.make(els.ed.value);
      return true;
    } catch (e) {
      showError(e.message);
      say('Le programme n’a pas pu démarrer.');
      return false;
    }
  }

  function reset() {
    stopLoop();
    clearRun();
    els.run.disabled = false; els.step.disabled = false;
    say('Prêt.');
  }

  const speedValue = () => Math.max(1, Math.round(Math.pow(10, parseFloat(els.speed.value))));
  function updateSpeed() { const v = speedValue(); els.speedv.textContent = v >= 1000 ? 'très vite' : v + ' pas/s'; }

  function mark(h) {
    if (lastHl) for (let i = lastHl[0]; i <= lastHl[1]; i++) if (spans[i]) { spans[i].classList.remove('on'); spans[i].classList.add('seen'); }
    if (h) for (let i = h[0]; i <= h[1]; i++) if (spans[i]) spans[i].classList.add('on');
    lastHl = h;
    if (h && spans[h[0]]) {
      const s = spans[h[0]], box = els.ed;
      if (s.offsetTop < box.scrollTop || s.offsetTop > box.scrollTop + box.clientHeight - 30) box.scrollTop = Math.max(0, s.offsetTop - 60);
    }
  }

  function stepOnce() {
    if (dead) return false;
    if (!mach && !build()) { dead = true; return false; }
    let f;
    try { f = mach.step(); } catch (e) { stopLoop(); showError(e.message); say('Le programme s’est arrêté sur une erreur.'); dead = true; return false; }
    steps++;
    if (f.hl) mark(f.hl);
    if (f.out && els.out.textContent.length < MAX_OUT) els.out.textContent += f.out;
    if (f.state) els.state.textContent = f.state;
    if (f.done) { finish(); return false; }
    if (steps > MAX_STEPS) { stopLoop(); showError('trop de pas (boucle infinie ?). Le programme est arrêté.'); say('Arrêté.'); dead = true; return false; }
    return true;
  }

  function finish() {
    stopLoop();
    dead = true;
    const first = !found.has(cur.id);
    found.add(cur.id);
    refreshList();
    if (found.size === LANGS.length) say('Les six langages sont retrouvés. Ils n’étaient pas perdus, juste oubliés.');
    else say(cur.name + ' a fini son programme' + (first ? ' : retrouvé (' + found.size + ' sur ' + LANGS.length + ').' : '.'));
  }

  function loop(t) {
    if (!running) return;
    const dt = Math.min(t - last, 100);
    last = t;
    acc += dt * speedValue() / 1000;
    let n = Math.floor(acc);
    acc -= n;
    while (n-- > 0) if (!stepOnce()) return;
    raf = requestAnimationFrame(loop);
  }

  els.run.addEventListener('click', () => {
    if (!ready) return;
    if (running) { stopLoop(); say('En pause.'); return; }
    if (dead) { clearRun(); }
    running = true;
    els.run.textContent = 'Pause';
    say('Exécution…');
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });
  els.step.addEventListener('click', () => { if (ready && !running) { if (dead) clearRun(); stepOnce(); } });
  els.reset.addEventListener('click', () => { if (ready) reset(); });
  els.restore.addEventListener('click', () => {
    if (!ready) return;
    stopLoop();
    els.ed.value = cur.code;
    paint();
    reset();
    say('Exemple d’origine restauré.');
  });
  els.speed.addEventListener('input', updateSpeed);

  /* modifier le code remet la machine à zéro */
  els.ed.addEventListener('input', () => {
    if (!ready) return;
    stopLoop();
    paint();
    clearRun();
    els.run.disabled = false; els.step.disabled = false;
    say('Code modifié.');
  });

  /* boutons d'insertion pour Whitespace */
  els.inserts.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !ready) return;
    const g = b.dataset.g;
    els.ed.focus();
    els.ed.setRangeText(g === '↵' ? '↵\n' : g, els.ed.selectionStart, els.ed.selectionEnd, 'end');
    els.ed.dispatchEvent(new Event('input'));
  });

  refreshList();
  select(LANGS[2]);
})();
