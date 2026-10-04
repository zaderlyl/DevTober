// Day 04 - Drift : les langues. Le sélecteur du haut traduit la page ; le sélecteur « Wikipédia » choisit l'édition
// de l'encyclopédie dans laquelle on dérive (elle suit la langue de la page tant qu'on n'en choisit pas une autre).

// Les langues de la page (celles qui ont toutes leurs traductions ci-dessous)
const UI_LANGS = { fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', id: 'Bahasa Indonesia', ja: '日本語' };
// Les éditions de Wikipédia proposées : les langues de la page, plus quelques grandes éditions
const EDITIONS = { ...UI_LANGS, nl: 'Nederlands', sv: 'Svenska', pl: 'Polski', ru: 'Русский', tr: 'Türkçe', zh: '中文', ko: '한국어', ar: 'العربية' };
// L'article de départ par défaut de chaque édition (vérifié : tous existent)
const START_ARTICLE = { fr: 'Pizza', en: 'Pizza', es: 'Pizza', de: 'Pizza', it: 'Pizza', pt: 'Pizza', id: 'Pizza', ja: 'ピザ', nl: 'Pizza', sv: 'Pizza', pl: 'Pizza', ru: 'Пицца', tr: 'Pizza', zh: '比萨', ko: '피자', ar: 'بيتزا' };

// Les textes. {nom} = valeur insérée ; **gras** ; un objet {one, other} = une forme au singulier et une au pluriel.
const STR = {
  fr: {
    ui: 'Langue', edition: 'Wikipédia', start: 'Article de départ', hops: 'Sauts (X)', speed: 'Vitesse', slow: 'Lente', normal: 'Normale', fast: 'Rapide',
    go: 'Dériver', stop: 'Arrêter', rand: 'Au hasard', randTitle: 'Choisir un article au hasard',
    sub: "On part d'un article Wikipédia. À chaque étape, la page **compte les liens** vers d'autres pages, **tire un numéro au hasard** et **suit ce lien**. Elle recommence X fois : voilà la dérive.",
    idle: 'Choisis un article et un nombre de sauts, puis lance la dérive.',
    note: "Les pages et leurs liens viennent en direct de Wikipédia, directement depuis ton navigateur : il n'y a aucun serveur entre les deux. Chaque saut fait deux requêtes (la page, puis sa vignette et sa première phrase), avec une petite pause.",
    mapLabel: 'Le chemin parcouru de page en page',
    opening: 'Ouverture de {title}…',
    progress: 'Tu es parti de {start}, tu es maintenant à {cur}, à {hops} (sur {total}).',
    deadend: "Impasse : {title} ne contient aucun lien. La dérive s'arrête après {hops}.",
    done: 'Terminé : parti de {start}, arrivé à {cur} après {hops}.',
    revisits: { one: ' Tu es repassé 1 fois par une page déjà visitée.', other: ' Tu es repassé {n} fois par une page déjà visitée.' },
    stopped: 'Arrêté après {hops}.',
    failed: "La dérive s'est interrompue après {hops} : {msg}",
    missing: "l'article « {title} » n'existe pas", randFail: "Impossible de tirer un article au hasard pour l'instant.", needStart: 'Indique un article de départ.',
    loading: 'Chargement de la fiche…', http: 'Wikipédia a répondu HTTP {code}',
    hopsWord: { one: '{n} saut', other: '{n} sauts' }, pagesLinked: { one: '{n} page liée', other: '{n} pages liées' }, draw: 'tirage n°{k} sur {n}',
  },
  en: {
    ui: 'Language', edition: 'Wikipedia', start: 'Starting article', hops: 'Hops (X)', speed: 'Speed', slow: 'Slow', normal: 'Normal', fast: 'Fast',
    go: 'Drift', stop: 'Stop', rand: 'Random', randTitle: 'Pick a random article',
    sub: 'We start from a Wikipedia article. At each step, the page **counts the links** to other pages, **draws a random number** and **follows that link**. It repeats X times: that is the drift.',
    idle: 'Pick an article and a number of hops, then start the drift.',
    note: 'The pages and their links come live from Wikipedia, straight from your browser: there is no server in between. Each hop makes two requests (the page, then its thumbnail and first sentence), with a short pause.',
    mapLabel: 'The path travelled from page to page',
    opening: 'Opening {title}…',
    progress: 'You started from {start}, you are now at {cur}, after {hops} (of {total}).',
    deadend: 'Dead end: {title} has no links. The drift stops after {hops}.',
    done: 'Done: started from {start}, arrived at {cur} after {hops}.',
    revisits: { one: ' You passed through an already visited page once.', other: ' You passed through an already visited page {n} times.' },
    stopped: 'Stopped after {hops}.',
    failed: 'The drift was interrupted after {hops}: {msg}',
    missing: 'the article "{title}" does not exist', randFail: 'Could not pick a random article right now.', needStart: 'Enter a starting article.',
    loading: 'Loading the card…', http: 'Wikipedia answered HTTP {code}',
    hopsWord: { one: '{n} hop', other: '{n} hops' }, pagesLinked: { one: '{n} linked page', other: '{n} linked pages' }, draw: 'draw #{k} of {n}',
  },
  es: {
    ui: 'Idioma', edition: 'Wikipedia', start: 'Artículo de inicio', hops: 'Saltos (X)', speed: 'Velocidad', slow: 'Lenta', normal: 'Normal', fast: 'Rápida',
    go: 'Derivar', stop: 'Detener', rand: 'Al azar', randTitle: 'Elegir un artículo al azar',
    sub: 'Partimos de un artículo de Wikipedia. En cada paso, la página **cuenta los enlaces** hacia otras páginas, **saca un número al azar** y **sigue ese enlace**. Lo repite X veces: eso es la deriva.',
    idle: 'Elige un artículo y un número de saltos, y lanza la deriva.',
    note: 'Las páginas y sus enlaces vienen en directo de Wikipedia, desde tu navegador: no hay ningún servidor entre ambos. Cada salto hace dos peticiones (la página, y luego su miniatura y su primera frase), con una pequeña pausa.',
    mapLabel: 'El camino recorrido de página en página',
    opening: 'Abriendo {title}…',
    progress: 'Saliste de {start}, ahora estás en {cur}, a {hops} (de {total}).',
    deadend: 'Callejón sin salida: {title} no contiene ningún enlace. La deriva se detiene tras {hops}.',
    done: 'Terminado: saliste de {start}, llegaste a {cur} tras {hops}.',
    revisits: { one: ' Has vuelto 1 vez a una página ya visitada.', other: ' Has vuelto {n} veces a una página ya visitada.' },
    stopped: 'Detenido tras {hops}.',
    failed: 'La deriva se interrumpió tras {hops}: {msg}',
    missing: 'el artículo «{title}» no existe', randFail: 'No se pudo elegir un artículo al azar por ahora.', needStart: 'Indica un artículo de inicio.',
    loading: 'Cargando la ficha…', http: 'Wikipedia respondió HTTP {code}',
    hopsWord: { one: '{n} salto', other: '{n} saltos' }, pagesLinked: { one: '{n} página enlazada', other: '{n} páginas enlazadas' }, draw: 'sorteo n.º {k} de {n}',
  },
  de: {
    ui: 'Sprache', edition: 'Wikipedia', start: 'Startartikel', hops: 'Sprünge (X)', speed: 'Tempo', slow: 'Langsam', normal: 'Normal', fast: 'Schnell',
    go: 'Driften', stop: 'Stopp', rand: 'Zufall', randTitle: 'Zufälligen Artikel wählen',
    sub: 'Wir starten bei einem Wikipedia-Artikel. In jedem Schritt **zählt die Seite die Links** zu anderen Seiten, **zieht eine Zufallszahl** und **folgt diesem Link**. Das wiederholt sie X-mal: das ist die Drift.',
    idle: 'Wähle einen Artikel und eine Anzahl Sprünge und starte die Drift.',
    note: 'Die Seiten und ihre Links kommen live von Wikipedia, direkt aus deinem Browser: Es gibt keinen Server dazwischen. Jeder Sprung macht zwei Anfragen (die Seite, dann ihr Vorschaubild und ihr erster Satz), mit einer kleinen Pause.',
    mapLabel: 'Der zurückgelegte Weg von Seite zu Seite',
    opening: '{title} wird geöffnet …',
    progress: 'Du bist bei {start} gestartet, du bist jetzt bei {cur}, nach {hops} (von {total}).',
    deadend: 'Sackgasse: {title} enthält keinen Link. Die Drift endet nach {hops}.',
    done: 'Fertig: gestartet bei {start}, angekommen bei {cur} nach {hops}.',
    revisits: { one: ' Du bist einmal auf eine bereits besuchte Seite zurückgekehrt.', other: ' Du bist {n}-mal auf eine bereits besuchte Seite zurückgekehrt.' },
    stopped: 'Gestoppt nach {hops}.',
    failed: 'Die Drift wurde nach {hops} unterbrochen: {msg}',
    missing: 'der Artikel „{title}“ existiert nicht', randFail: 'Ein Zufallsartikel konnte gerade nicht gewählt werden.', needStart: 'Gib einen Startartikel an.',
    loading: 'Infokarte wird geladen …', http: 'Wikipedia antwortete mit HTTP {code}',
    hopsWord: { one: '{n} Sprung', other: '{n} Sprüngen' }, pagesLinked: { one: '{n} verlinkte Seite', other: '{n} verlinkte Seiten' }, draw: 'Ziehung Nr. {k} von {n}',
  },
  it: {
    ui: 'Lingua', edition: 'Wikipedia', start: 'Articolo di partenza', hops: 'Salti (X)', speed: 'Velocità', slow: 'Lenta', normal: 'Normale', fast: 'Veloce',
    go: 'Deriva', stop: 'Ferma', rand: 'A caso', randTitle: 'Scegli un articolo a caso',
    sub: 'Si parte da un articolo di Wikipedia. A ogni passo, la pagina **conta i link** verso altre pagine, **estrae un numero a caso** e **segue quel link**. Ripete X volte: questa è la deriva.',
    idle: 'Scegli un articolo e un numero di salti, poi avvia la deriva.',
    note: "Le pagine e i loro link arrivano in diretta da Wikipedia, direttamente dal tuo browser: non c'è nessun server in mezzo. Ogni salto fa due richieste (la pagina, poi la sua miniatura e la sua prima frase), con una piccola pausa.",
    mapLabel: 'Il percorso fatto di pagina in pagina',
    opening: 'Apertura di {title}…',
    progress: 'Sei partito da {start}, ora sei a {cur}, a {hops} (su {total}).',
    deadend: 'Vicolo cieco: {title} non contiene nessun link. La deriva si ferma dopo {hops}.',
    done: 'Finito: partito da {start}, arrivato a {cur} dopo {hops}.',
    revisits: { one: ' Sei ripassato 1 volta da una pagina già visitata.', other: ' Sei ripassato {n} volte da una pagina già visitata.' },
    stopped: 'Fermato dopo {hops}.',
    failed: 'La deriva si è interrotta dopo {hops}: {msg}',
    missing: "l'articolo «{title}» non esiste", randFail: 'Impossibile scegliere un articolo a caso per ora.', needStart: 'Indica un articolo di partenza.',
    loading: 'Caricamento della scheda…', http: 'Wikipedia ha risposto HTTP {code}',
    hopsWord: { one: '{n} salto', other: '{n} salti' }, pagesLinked: { one: '{n} pagina collegata', other: '{n} pagine collegate' }, draw: 'estrazione n°{k} su {n}',
  },
  pt: {
    ui: 'Idioma', edition: 'Wikipédia', start: 'Artigo de partida', hops: 'Saltos (X)', speed: 'Velocidade', slow: 'Lenta', normal: 'Normal', fast: 'Rápida',
    go: 'Derivar', stop: 'Parar', rand: 'Aleatório', randTitle: 'Escolher um artigo aleatório',
    sub: 'Partimos de um artigo da Wikipédia. A cada passo, a página **conta os links** para outras páginas, **sorteia um número** e **segue esse link**. Repete X vezes: é a deriva.',
    idle: 'Escolha um artigo e um número de saltos, e inicie a deriva.',
    note: 'As páginas e seus links vêm ao vivo da Wikipédia, direto do seu navegador: não há nenhum servidor entre os dois. Cada salto faz duas requisições (a página, depois sua miniatura e sua primeira frase), com uma pequena pausa.',
    mapLabel: 'O caminho percorrido de página em página',
    opening: 'Abrindo {title}…',
    progress: 'Você partiu de {start}, agora está em {cur}, a {hops} (de {total}).',
    deadend: 'Beco sem saída: {title} não contém nenhum link. A deriva para após {hops}.',
    done: 'Concluído: partiu de {start}, chegou a {cur} após {hops}.',
    revisits: { one: ' Você voltou 1 vez a uma página já visitada.', other: ' Você voltou {n} vezes a uma página já visitada.' },
    stopped: 'Parado após {hops}.',
    failed: 'A deriva foi interrompida após {hops}: {msg}',
    missing: 'o artigo «{title}» não existe', randFail: 'Não foi possível escolher um artigo aleatório agora.', needStart: 'Indique um artigo de partida.',
    loading: 'Carregando a ficha…', http: 'A Wikipédia respondeu HTTP {code}',
    hopsWord: { one: '{n} salto', other: '{n} saltos' }, pagesLinked: { one: '{n} página ligada', other: '{n} páginas ligadas' }, draw: 'sorteio n.º {k} de {n}',
  },
  id: {
    ui: 'Bahasa', edition: 'Wikipedia', start: 'Artikel awal', hops: 'Lompatan (X)', speed: 'Kecepatan', slow: 'Lambat', normal: 'Normal', fast: 'Cepat',
    go: 'Hanyut', stop: 'Berhenti', rand: 'Acak', randTitle: 'Pilih artikel secara acak',
    sub: 'Kita mulai dari sebuah artikel Wikipedia. Di setiap langkah, halaman ini **menghitung tautan** ke halaman lain, **mengambil satu nomor secara acak**, dan **mengikuti tautan itu**. Diulang X kali: itulah hanyutan (drift).',
    idle: 'Pilih artikel dan jumlah lompatan, lalu mulai hanyutan.',
    note: 'Halaman dan tautannya datang langsung dari Wikipedia, langsung dari browser kamu: tidak ada server di antaranya. Setiap lompatan melakukan dua permintaan (halamannya, lalu gambar mini dan kalimat pertamanya), dengan jeda singkat.',
    mapLabel: 'Jalur yang ditempuh dari halaman ke halaman',
    opening: 'Membuka {title}…',
    progress: 'Kamu berangkat dari {start}, sekarang kamu di {cur}, setelah {hops} (dari {total}).',
    deadend: 'Jalan buntu: {title} tidak memiliki tautan. Hanyutan berhenti setelah {hops}.',
    done: 'Selesai: berangkat dari {start}, tiba di {cur} setelah {hops}.',
    revisits: { other: ' Kamu kembali {n} kali ke halaman yang sudah dikunjungi.' },
    stopped: 'Dihentikan setelah {hops}.',
    failed: 'Hanyutan terhenti setelah {hops}: {msg}',
    missing: 'artikel «{title}» tidak ada', randFail: 'Belum bisa memilih artikel acak saat ini.', needStart: 'Tentukan artikel awal.',
    loading: 'Memuat kartu halaman…', http: 'Wikipedia menjawab HTTP {code}',
    hopsWord: { other: '{n} lompatan' }, pagesLinked: { other: '{n} halaman tertaut' }, draw: 'undian ke-{k} dari {n}',
  },
  ja: {
    ui: '言語', edition: 'Wikipedia', start: '出発する記事', hops: 'ジャンプ数 (X)', speed: '速さ', slow: 'ゆっくり', normal: 'ふつう', fast: '速い',
    go: '漂流する', stop: '停止', rand: 'ランダム', randTitle: 'ランダムな記事を選ぶ',
    sub: 'Wikipediaの記事から出発します。各ステップで、ページは他のページへの**リンクを数え**、**ランダムに番号を引き**、**そのリンクをたどります**。これをX回繰り返す――それが漂流（ドリフト）です。',
    idle: '記事とジャンプ数を選んで、漂流を始めましょう。',
    note: 'ページとそのリンクは、あなたのブラウザから直接Wikipediaにライブで取得されます。間にサーバーはありません。1回のジャンプで2回のリクエスト（ページ本体、次にサムネイルと最初の一文）を行い、少し間を置きます。',
    mapLabel: 'ページからページへたどった道のり',
    opening: '{title} を開いています…',
    progress: '{start} から出発し、いまは {cur} にいます。{hops}進みました（全 {total}）。',
    deadend: '行き止まり: {title} にはリンクがありません。{hops}進んだところで漂流を終了します。',
    done: '完了: {start} から出発し、{hops}で {cur} に到着しました。',
    revisits: { other: ' すでに訪れたページに {n} 回戻りました。' },
    stopped: '{hops}進んだところで停止しました。',
    failed: '{hops}進んだところで漂流が中断されました: {msg}',
    missing: '「{title}」という記事は存在しません', randFail: '今はランダムな記事を選べません。', needStart: '出発する記事を入力してください。',
    loading: '記事カードを読み込み中…', http: 'WikipediaがHTTP {code}を返しました',
    hopsWord: { other: '{n}ジャンプ' }, pagesLinked: { other: '{n}ページにリンク' }, draw: '抽選 {k}／{n}',
  },
};

// ---- les outils
let UI = 'fr';
const _rules = {};
const _pick = n => (_rules[UI] = _rules[UI] || new Intl.PluralRules(UI)).select(n);
const _fill = (s, v) => s.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
function _tpl(key, n) {
  const s = (STR[UI] && STR[UI][key] !== undefined) ? STR[UI][key] : STR.en[key];
  if (typeof s === 'string') return s;
  return s[_pick(n)] || s.other || '';
}
// un texte avec ses valeurs ; pour les pluriels, la valeur « n » choisit la forme
function t(key, vars = {}) { return _fill(_tpl(key, vars.n), vars); }
// pareil, mais en morceaux : les valeurs listées dans « bold » sortent en gras (on construit des éléments, jamais de HTML)
function tparts(key, vars, bold = []) {
  return _tpl(key, vars.n).split(/(\{\w+\})/).filter(Boolean).map(p => {
    const m = p.match(/^\{(\w+)\}$/);
    if (!m || !(m[1] in vars)) return p;
    return bold.includes(m[1]) ? { b: String(vars[m[1]]) } : String(vars[m[1]]);
  });
}
// un texte avec du **gras**, écrit dans un élément sans innerHTML
function setRich(el, text) {
  el.replaceChildren(...text.split('**').map((s, i) => { if (i % 2 === 0) return document.createTextNode(s); const b = document.createElement('b'); b.textContent = s; return b; }));
}
// traduit tout ce qui est marqué dans la page
function applyUI(lang) {
  UI = STR[lang] ? lang : 'en';
  document.documentElement.lang = UI;
  for (const e of document.querySelectorAll('[data-i18n]')) e.textContent = t(e.dataset.i18n);
  for (const e of document.querySelectorAll('[data-i18n-rich]')) setRich(e, t(e.dataset.i18nRich));
  for (const e of document.querySelectorAll('[data-i18n-title]')) e.title = t(e.dataset.i18nTitle);
  for (const e of document.querySelectorAll('[data-i18n-aria]')) e.setAttribute('aria-label', t(e.dataset.i18nAria));
}
// la langue du navigateur, si on la propose
const detectUI = () => ((navigator.languages || [navigator.language || 'en']).map(l => String(l).slice(0, 2).toLowerCase()).find(l => UI_LANGS[l])) || 'en';
