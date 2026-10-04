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
    sub: 'On part d\'un article Wikipédia. Plusieurs dériveurs partent du même point. À chaque étape, chacun **compte les liens** de sa page, **tire un numéro au hasard** et **suit ce lien**. Ils recommencent X fois : voilà la dérive, et l\'effet papillon.',
    idle: 'Choisis un article, un nombre de dériveurs et de sauts, puis lance la dérive.',
    note: 'Les pages et leurs liens viennent en direct de Wikipédia, directement depuis ton navigateur : il n\'y a aucun serveur entre les deux. Chaque saut de chaque dériveur fait deux requêtes (la page, puis sa vignette et sa première phrase), avec une petite pause, et jamais plus de trois à la fois.',
    mapLabel: 'Le chemin parcouru de page en page',
    opening: 'Ouverture de {title}…',
    stopped: 'Arrêté après {hops}.',
    failed: "La dérive s'est interrompue après {hops} : {msg}",
    missing: "l'article « {title} » n'existe pas", randFail: "Impossible de tirer un article au hasard pour l'instant.", needStart: 'Indique un article de départ.',
    loading: 'Chargement de la fiche…', http: 'Wikipédia a répondu HTTP {code}',
    hopsWord: { one: '{n} saut', other: '{n} sauts' }, pagesLinked: { one: '{n} page liée', other: '{n} pages liées' }, draw: 'tirage n°{k} sur {n}',
    drifters: 'Dériveurs',
    runStatus: '{drifters} depuis {start} : saut {i} sur {total}.',
    deadend: 'Impasse : {title} ne contient aucun lien.',
    doneMulti: 'Terminé : {drifters} depuis {start}, après {hops}.',
    spread: { one: 'Ils ont fini au même endroit.', other: 'Ils ont fini à {n} endroits différents.' },
    meet: { one: 'Deux branches se sont recroisées sur une même page.', other: 'Des branches se sont recroisées sur {n} pages.' },
    driftersWord: { one: '{n} dériveur', other: '{n} dériveurs' },
    stuck: 'Branche {i} : impasse sur {title} (aucun lien).',
    branchFailed: 'Branche {i} interrompue : {msg}',
    branchN: 'Branche {i}',
    fitAll: 'Tout voir',
    zoomIn: 'Zoomer',
    zoomOut: 'Dézoomer',
    goBranch: 'Aller à cette branche',
    navHint: 'Glisse pour te déplacer · Ctrl ou ⌘ + molette (ou deux doigts) pour zoomer · clique une carte pour rejoindre sa branche.',
    capped: 'Avec {drifters}, le nombre de sauts est limité à {max} (pour rester poli avec Wikipédia).',
  },
  en: {
    ui: 'Language', edition: 'Wikipedia', start: 'Starting article', hops: 'Hops (X)', speed: 'Speed', slow: 'Slow', normal: 'Normal', fast: 'Fast',
    go: 'Drift', stop: 'Stop', rand: 'Random', randTitle: 'Pick a random article',
    sub: 'We start from a Wikipedia article. Several drifters leave from the same point. At each step, each one **counts the links** on its page, **draws a random number** and **follows that link**. They repeat X times: that is the drift, and the butterfly effect.',
    idle: 'Pick an article, a number of drifters and hops, then start the drift.',
    note: 'The pages and their links come live from Wikipedia, straight from your browser: there is no server in between. Each hop of each drifter makes two requests (the page, then its thumbnail and first sentence), with a short pause, and never more than three at a time.',
    mapLabel: 'The path travelled from page to page',
    opening: 'Opening {title}…',
    stopped: 'Stopped after {hops}.',
    failed: 'The drift was interrupted after {hops}: {msg}',
    missing: 'the article "{title}" does not exist', randFail: 'Could not pick a random article right now.', needStart: 'Enter a starting article.',
    loading: 'Loading the card…', http: 'Wikipedia answered HTTP {code}',
    hopsWord: { one: '{n} hop', other: '{n} hops' }, pagesLinked: { one: '{n} linked page', other: '{n} linked pages' }, draw: 'draw #{k} of {n}',
    drifters: 'Drifters',
    runStatus: '{drifters} from {start}: hop {i} of {total}.',
    deadend: 'Dead end: {title} has no links.',
    doneMulti: 'Done: {drifters} from {start}, after {hops}.',
    spread: { one: 'They all ended up in the same place.', other: 'They ended up in {n} different places.' },
    meet: { one: 'Two branches crossed paths on the same page.', other: 'Branches crossed paths on {n} pages.' },
    driftersWord: { one: '{n} drifter', other: '{n} drifters' },
    stuck: 'Branch {i}: dead end at {title} (no links).',
    branchFailed: 'Branch {i} interrupted: {msg}',
    branchN: 'Branch {i}',
    fitAll: 'Fit all',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    goBranch: 'Go to this branch',
    navHint: 'Drag to move · Ctrl or ⌘ + scroll (or two fingers) to zoom · click a card to jump to its branch.',
    capped: 'With {drifters}, the number of hops is limited to {max} (to stay polite to Wikipedia).',
  },
  es: {
    ui: 'Idioma', edition: 'Wikipedia', start: 'Artículo de inicio', hops: 'Saltos (X)', speed: 'Velocidad', slow: 'Lenta', normal: 'Normal', fast: 'Rápida',
    go: 'Derivar', stop: 'Detener', rand: 'Al azar', randTitle: 'Elegir un artículo al azar',
    sub: 'Partimos de un artículo de Wikipedia. Varios derivadores salen del mismo punto. En cada paso, cada uno **cuenta los enlaces** de su página, **saca un número al azar** y **sigue ese enlace**. Lo repiten X veces: eso es la deriva, y el efecto mariposa.',
    idle: 'Elige un artículo, un número de derivadores y de saltos, y lanza la deriva.',
    note: 'Las páginas y sus enlaces vienen en directo de Wikipedia, desde tu navegador: no hay ningún servidor entre ambos. Cada salto de cada derivador hace dos peticiones (la página, y luego su miniatura y su primera frase), con una pequeña pausa, y nunca más de tres a la vez.',
    mapLabel: 'El camino recorrido de página en página',
    opening: 'Abriendo {title}…',
    stopped: 'Detenido tras {hops}.',
    failed: 'La deriva se interrumpió tras {hops}: {msg}',
    missing: 'el artículo «{title}» no existe', randFail: 'No se pudo elegir un artículo al azar por ahora.', needStart: 'Indica un artículo de inicio.',
    loading: 'Cargando la ficha…', http: 'Wikipedia respondió HTTP {code}',
    hopsWord: { one: '{n} salto', other: '{n} saltos' }, pagesLinked: { one: '{n} página enlazada', other: '{n} páginas enlazadas' }, draw: 'sorteo n.º {k} de {n}',
    drifters: 'Derivadores',
    runStatus: '{drifters} desde {start}: salto {i} de {total}.',
    deadend: 'Callejón sin salida: {title} no contiene ningún enlace.',
    doneMulti: 'Terminado: {drifters} desde {start}, tras {hops}.',
    spread: { one: 'Todos acabaron en el mismo lugar.', other: 'Acabaron en {n} lugares distintos.' },
    meet: { one: 'Dos ramas se cruzaron en una misma página.', other: 'Las ramas se cruzaron en {n} páginas.' },
    driftersWord: { one: '{n} derivador', other: '{n} derivadores' },
    stuck: 'Rama {i}: callejón sin salida en {title} (sin enlaces).',
    branchFailed: 'Rama {i} interrumpida: {msg}',
    branchN: 'Rama {i}',
    fitAll: 'Ver todo',
    zoomIn: 'Acercar',
    zoomOut: 'Alejar',
    goBranch: 'Ir a esta rama',
    navHint: 'Arrastra para moverte · Ctrl o ⌘ + rueda (o dos dedos) para hacer zoom · haz clic en una ficha para ir a su rama.',
    capped: 'Con {drifters}, el número de saltos se limita a {max} (por cortesía con Wikipedia).',
  },
  de: {
    ui: 'Sprache', edition: 'Wikipedia', start: 'Startartikel', hops: 'Sprünge (X)', speed: 'Tempo', slow: 'Langsam', normal: 'Normal', fast: 'Schnell',
    go: 'Driften', stop: 'Stopp', rand: 'Zufall', randTitle: 'Zufälligen Artikel wählen',
    sub: 'Wir starten bei einem Wikipedia-Artikel. Mehrere Driftende brechen vom selben Punkt auf. In jedem Schritt **zählt jeder die Links** seiner Seite, **zieht eine Zufallszahl** und **folgt diesem Link**. Das wiederholen sie X-mal: das ist die Drift, und der Schmetterlingseffekt.',
    idle: 'Wähle einen Artikel, die Anzahl der Driftenden und der Sprünge und starte die Drift.',
    note: 'Die Seiten und ihre Links kommen live von Wikipedia, direkt aus deinem Browser: Es gibt keinen Server dazwischen. Jeder Sprung jedes Driftenden macht zwei Anfragen (die Seite, dann ihr Vorschaubild und ihr erster Satz), mit einer kleinen Pause, und nie mehr als drei gleichzeitig.',
    mapLabel: 'Der zurückgelegte Weg von Seite zu Seite',
    opening: '{title} wird geöffnet …',
    stopped: 'Gestoppt nach {hops}.',
    failed: 'Die Drift wurde nach {hops} unterbrochen: {msg}',
    missing: 'der Artikel „{title}“ existiert nicht', randFail: 'Ein Zufallsartikel konnte gerade nicht gewählt werden.', needStart: 'Gib einen Startartikel an.',
    loading: 'Infokarte wird geladen …', http: 'Wikipedia antwortete mit HTTP {code}',
    hopsWord: { one: '{n} Sprung', other: '{n} Sprüngen' }, pagesLinked: { one: '{n} verlinkte Seite', other: '{n} verlinkte Seiten' }, draw: 'Ziehung Nr. {k} von {n}',
    drifters: 'Driftende',
    runStatus: '{drifters} ab {start}: Sprung {i} von {total}.',
    deadend: 'Sackgasse: {title} enthält keinen Link.',
    doneMulti: 'Fertig: {drifters} ab {start}, nach {hops}.',
    spread: { one: 'Alle sind am selben Ort gelandet.', other: 'Sie sind an {n} verschiedenen Orten gelandet.' },
    meet: { one: 'Zwei Zweige haben sich auf derselben Seite wieder getroffen.', other: 'Zweige haben sich auf {n} Seiten wieder getroffen.' },
    driftersWord: { one: '{n} Driftender', other: '{n} Driftende' },
    stuck: 'Zweig {i}: Sackgasse bei {title} (keine Links).',
    branchFailed: 'Zweig {i} unterbrochen: {msg}',
    branchN: 'Zweig {i}',
    fitAll: 'Alles zeigen',
    zoomIn: 'Vergrößern',
    zoomOut: 'Verkleinern',
    goBranch: 'Zu diesem Zweig',
    navHint: 'Ziehen zum Verschieben · Strg oder ⌘ + Scrollen (oder zwei Finger) zum Zoomen · Karte anklicken, um zu ihrem Zweig zu springen.',
    capped: 'Bei {drifters} ist die Anzahl der Sprünge auf {max} begrenzt (aus Rücksicht auf Wikipedia).',
  },
  it: {
    ui: 'Lingua', edition: 'Wikipedia', start: 'Articolo di partenza', hops: 'Salti (X)', speed: 'Velocità', slow: 'Lenta', normal: 'Normale', fast: 'Veloce',
    go: 'Deriva', stop: 'Ferma', rand: 'A caso', randTitle: 'Scegli un articolo a caso',
    sub: 'Si parte da un articolo di Wikipedia. Più esploratori partono dallo stesso punto. A ogni passo, ciascuno **conta i link** della sua pagina, **estrae un numero a caso** e **segue quel link**. Ripetono X volte: questa è la deriva, e l\'effetto farfalla.',
    idle: 'Scegli un articolo, un numero di esploratori e di salti, poi avvia la deriva.',
    note: 'Le pagine e i loro link arrivano in diretta da Wikipedia, direttamente dal tuo browser: non c\'è nessun server in mezzo. Ogni salto di ogni esploratore fa due richieste (la pagina, poi la sua miniatura e la sua prima frase), con una piccola pausa, e mai più di tre alla volta.',
    mapLabel: 'Il percorso fatto di pagina in pagina',
    opening: 'Apertura di {title}…',
    stopped: 'Fermato dopo {hops}.',
    failed: 'La deriva si è interrotta dopo {hops}: {msg}',
    missing: "l'articolo «{title}» non esiste", randFail: 'Impossibile scegliere un articolo a caso per ora.', needStart: 'Indica un articolo di partenza.',
    loading: 'Caricamento della scheda…', http: 'Wikipedia ha risposto HTTP {code}',
    hopsWord: { one: '{n} salto', other: '{n} salti' }, pagesLinked: { one: '{n} pagina collegata', other: '{n} pagine collegate' }, draw: 'estrazione n°{k} su {n}',
    drifters: 'Esploratori',
    runStatus: '{drifters} da {start}: salto {i} di {total}.',
    deadend: 'Vicolo cieco: {title} non contiene nessun link.',
    doneMulti: 'Finito: {drifters} da {start}, dopo {hops}.',
    spread: { one: 'Sono finiti tutti nello stesso posto.', other: 'Sono finiti in {n} posti diversi.' },
    meet: { one: 'Due rami si sono incrociati sulla stessa pagina.', other: 'I rami si sono incrociati su {n} pagine.' },
    driftersWord: { one: '{n} esploratore', other: '{n} esploratori' },
    stuck: 'Ramo {i}: vicolo cieco su {title} (nessun link).',
    branchFailed: 'Ramo {i} interrotto: {msg}',
    branchN: 'Ramo {i}',
    fitAll: 'Vedi tutto',
    zoomIn: 'Ingrandisci',
    zoomOut: 'Riduci',
    goBranch: 'Vai a questo ramo',
    navHint: 'Trascina per spostarti · Ctrl o ⌘ + rotellina (o due dita) per zoomare · clicca una scheda per raggiungere il suo ramo.',
    capped: 'Con {drifters}, il numero di salti è limitato a {max} (per rispetto verso Wikipedia).',
  },
  pt: {
    ui: 'Idioma', edition: 'Wikipédia', start: 'Artigo de partida', hops: 'Saltos (X)', speed: 'Velocidade', slow: 'Lenta', normal: 'Normal', fast: 'Rápida',
    go: 'Derivar', stop: 'Parar', rand: 'Aleatório', randTitle: 'Escolher um artigo aleatório',
    sub: 'Partimos de um artigo da Wikipédia. Vários derivantes saem do mesmo ponto. A cada passo, cada um **conta os links** da sua página, **sorteia um número** e **segue esse link**. Repetem X vezes: é a deriva, e o efeito borboleta.',
    idle: 'Escolha um artigo, um número de derivantes e de saltos, e inicie a deriva.',
    note: 'As páginas e seus links vêm ao vivo da Wikipédia, direto do seu navegador: não há nenhum servidor entre os dois. Cada salto de cada derivante faz duas requisições (a página, depois sua miniatura e sua primeira frase), com uma pequena pausa, e nunca mais de três ao mesmo tempo.',
    mapLabel: 'O caminho percorrido de página em página',
    opening: 'Abrindo {title}…',
    stopped: 'Parado após {hops}.',
    failed: 'A deriva foi interrompida após {hops}: {msg}',
    missing: 'o artigo «{title}» não existe', randFail: 'Não foi possível escolher um artigo aleatório agora.', needStart: 'Indique um artigo de partida.',
    loading: 'Carregando a ficha…', http: 'A Wikipédia respondeu HTTP {code}',
    hopsWord: { one: '{n} salto', other: '{n} saltos' }, pagesLinked: { one: '{n} página ligada', other: '{n} páginas ligadas' }, draw: 'sorteio n.º {k} de {n}',
    drifters: 'Derivantes',
    runStatus: '{drifters} a partir de {start}: salto {i} de {total}.',
    deadend: 'Beco sem saída: {title} não contém nenhum link.',
    doneMulti: 'Concluído: {drifters} a partir de {start}, após {hops}.',
    spread: { one: 'Todos terminaram no mesmo lugar.', other: 'Terminaram em {n} lugares diferentes.' },
    meet: { one: 'Dois ramos se cruzaram na mesma página.', other: 'Os ramos se cruzaram em {n} páginas.' },
    driftersWord: { one: '{n} derivante', other: '{n} derivantes' },
    stuck: 'Ramo {i}: beco sem saída em {title} (sem links).',
    branchFailed: 'Ramo {i} interrompido: {msg}',
    branchN: 'Ramo {i}',
    fitAll: 'Ver tudo',
    zoomIn: 'Aproximar',
    zoomOut: 'Afastar',
    goBranch: 'Ir para este ramo',
    navHint: 'Arraste para se mover · Ctrl ou ⌘ + rolagem (ou dois dedos) para dar zoom · clique em uma ficha para ir ao seu ramo.',
    capped: 'Com {drifters}, o número de saltos é limitado a {max} (por respeito à Wikipédia).',
  },
  id: {
    ui: 'Bahasa', edition: 'Wikipedia', start: 'Artikel awal', hops: 'Lompatan (X)', speed: 'Kecepatan', slow: 'Lambat', normal: 'Normal', fast: 'Cepat',
    go: 'Hanyut', stop: 'Berhenti', rand: 'Acak', randTitle: 'Pilih artikel secara acak',
    sub: 'Kita mulai dari sebuah artikel Wikipedia. Beberapa penghanyut berangkat dari titik yang sama. Di setiap langkah, masing-masing **menghitung tautan** di halamannya, **mengambil satu nomor secara acak**, dan **mengikuti tautan itu**. Diulang X kali: itulah hanyutan, dan efek kupu-kupu.',
    idle: 'Pilih artikel, jumlah penghanyut dan lompatan, lalu mulai hanyutan.',
    note: 'Halaman dan tautannya datang langsung dari Wikipedia, langsung dari browser kamu: tidak ada server di antaranya. Setiap lompatan dari setiap penghanyut melakukan dua permintaan (halamannya, lalu gambar mini dan kalimat pertamanya), dengan jeda singkat, dan tidak pernah lebih dari tiga sekaligus.',
    mapLabel: 'Jalur yang ditempuh dari halaman ke halaman',
    opening: 'Membuka {title}…',
    stopped: 'Dihentikan setelah {hops}.',
    failed: 'Hanyutan terhenti setelah {hops}: {msg}',
    missing: 'artikel «{title}» tidak ada', randFail: 'Belum bisa memilih artikel acak saat ini.', needStart: 'Tentukan artikel awal.',
    loading: 'Memuat kartu halaman…', http: 'Wikipedia menjawab HTTP {code}',
    hopsWord: { other: '{n} lompatan' }, pagesLinked: { other: '{n} halaman tertaut' }, draw: 'undian ke-{k} dari {n}',
    drifters: 'Penghanyut',
    runStatus: '{drifters} dari {start}: lompatan {i} dari {total}.',
    deadend: 'Jalan buntu: {title} tidak memiliki tautan.',
    doneMulti: 'Selesai: {drifters} dari {start}, setelah {hops}.',
    spread: { other: 'Mereka berakhir di {n} tempat berbeda.' },
    meet: { other: 'Cabang-cabang bertemu lagi di {n} halaman.' },
    driftersWord: { other: '{n} penghanyut' },
    stuck: 'Cabang {i}: jalan buntu di {title} (tanpa tautan).',
    branchFailed: 'Cabang {i} terhenti: {msg}',
    branchN: 'Cabang {i}',
    fitAll: 'Lihat semua',
    zoomIn: 'Perbesar',
    zoomOut: 'Perkecil',
    goBranch: 'Ke cabang ini',
    navHint: 'Seret untuk bergerak · Ctrl atau ⌘ + gulir (atau dua jari) untuk zoom · klik kartu untuk menuju cabangnya.',
    capped: 'Dengan {drifters}, jumlah lompatan dibatasi hingga {max} (agar tetap sopan kepada Wikipedia).',
  },
  ja: {
    ui: '言語', edition: 'Wikipedia', start: '出発する記事', hops: 'ジャンプ数 (X)', speed: '速さ', slow: 'ゆっくり', normal: 'ふつう', fast: '速い',
    go: '漂流する', stop: '停止', rand: 'ランダム', randTitle: 'ランダムな記事を選ぶ',
    sub: 'Wikipediaの記事から出発します。複数の漂流者が同じ地点から旅立ちます。各ステップで、それぞれが自分のページの**リンクを数え**、**ランダムに番号を引き**、**そのリンクをたどります**。これをX回繰り返す――それが漂流、そしてバタフライ効果です。',
    idle: '記事、漂流者の数、ジャンプ数を選んで、漂流を始めましょう。',
    note: 'ページとそのリンクは、あなたのブラウザから直接Wikipediaにライブで取得されます。間にサーバーはありません。各漂流者の1回のジャンプで2回のリクエスト（ページ本体、次にサムネイルと最初の一文）を行い、少し間を置き、同時に3件までに制限しています。',
    mapLabel: 'ページからページへたどった道のり',
    opening: '{title} を開いています…',
    stopped: '{hops}進んだところで停止しました。',
    failed: '{hops}進んだところで漂流が中断されました: {msg}',
    missing: '「{title}」という記事は存在しません', randFail: '今はランダムな記事を選べません。', needStart: '出発する記事を入力してください。',
    loading: '記事カードを読み込み中…', http: 'WikipediaがHTTP {code}を返しました',
    hopsWord: { other: '{n}ジャンプ' }, pagesLinked: { other: '{n}ページにリンク' }, draw: '抽選 {k}／{n}',
    drifters: '漂流者の数',
    runStatus: '{start} から {drifters}：{i} / {total} ジャンプ目。',
    deadend: '行き止まり: {title} にはリンクがありません。',
    doneMulti: '完了: {start} から {drifters}、{hops}進みました。',
    spread: { other: '{n} か所に分かれて到着しました。' },
    meet: { other: '{n} ページで枝が再び交わりました。' },
    driftersWord: { other: '{n}人' },
    stuck: '枝 {i}: {title} で行き止まり（リンクなし）。',
    branchFailed: '枝 {i} が中断されました: {msg}',
    branchN: '枝 {i}',
    fitAll: '全体を表示',
    zoomIn: '拡大',
    zoomOut: '縮小',
    goBranch: 'この枝へ移動',
    navHint: 'ドラッグで移動 · Ctrl または ⌘ + スクロール（または2本指）でズーム · カードをクリックするとその枝へ移動します。',
    capped: '{drifters}の場合、ジャンプ数は最大{max}に制限されます（Wikipediaへの配慮のため）。',
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
