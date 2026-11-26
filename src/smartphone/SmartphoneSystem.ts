import { sound } from '../audio/SoundEffects';
import { CharacterProfile, GameDifficulty, WeatherType } from '../types';

export type SmartphoneApp =
  | 'home'
  | 'browser'
  | 'messages'
  | 'contracts'
  | 'gps'
  | 'music'
  | 'bank'
  | 'weather';

export interface ChatMessage {
  id: string;
  sender: 'contact' | 'player';
  text: string;
  time: string;
}

export interface ChatContact {
  id: string;
  name: string;
  role: string;
  avatar: string;
  badgeColor: string;
  unread: boolean;
  messages: ChatMessage[];
  quickReplies: string[];
}

export interface StreetContract {
  id: string;
  title: string;
  targetDesc: string;
  rewardCash: number;
  rewardRep: number;
  progress: number;
  targetMax: number;
  isCompleted: boolean;
  icon: string;
}

export interface SmartphoneCallbacks {
  onFastTravel?: (targetPos: { x: number; y: number; z: number; heading?: number }) => void;
  onSetWeather?: (weather: WeatherType) => void;
  onCashBonus?: (amount: number, reason: string) => void;
  onRepBonus?: (amount: number) => void;
  onShowToast?: (message: string) => void;
  onSpawnCar?: (carId: string) => void;
  onOpenStateChanged?: (isOpen: boolean) => void;
}

export class SmartphoneSystem {
  public isOpen: boolean = false;
  public currentApp: SmartphoneApp = 'home';
  public currentUrl: string = 'drift://portal';
  public browserHistory: string[] = ['drift://portal'];
  public historyIndex: number = 0;

  private profileRef: CharacterProfile;
  private callbacks: SmartphoneCallbacks;
  private contacts: ChatContact[] = [];
  private activeChatContactId: string = 'luca';
  private contracts: StreetContract[] = [];
  private containerRoot: HTMLElement | null = null;
  private lastPlayerPos?: { x: number; y: number; z: number };
  private currentWeather: WeatherType = 'rain';
  private activeRadioChannelIndex: number = 0;
  private isRadioPlaying: boolean = true;
  private portalSearchQuery: string = '';

  private readonly radioChannels: Array<{ label: string; track: string }> = [
    { label: '📻 104.2 Neon Waves (Synth)', track: 'Midnight Phonk & Synthwave 24/7' },
    { label: '🔥 98.7 Tokyo Drift Phonk', track: 'Drift King Bassline · DJ Kaito' },
    { label: '⚡ 106.9 Cyberpunk Bass D&B', track: 'Overdrive Expressway Mix' },
    { label: '🕶️ 92.5 Underground Hip-Hop', track: 'La Casa Beats · Luca & Miguel Tape' },
  ];

  // Social feed like counters state
  public bleeterLikes: Record<string, number> = {
    post1: 342,
    post2: 1289,
    post3: 567,
    post4: 890,
  };
  public likedPosts: Set<string> = new Set();

  constructor(profile: CharacterProfile, callbacks: SmartphoneCallbacks = {}) {
    this.profileRef = profile;
    this.callbacks = callbacks;
    this.initContacts();
    this.initContracts();
  }

  private initContacts() {
    this.contacts = [
      {
        id: 'luca',
        name: 'Luca',
        role: 'Piloto & Parceiro de Garagem',
        avatar: '🏎️',
        badgeColor: '#00f0ff',
        unread: false,
        messages: [
          {
            id: 'm1',
            sender: 'contact',
            text: 'E aí! A suspensão nova do carro tá respondendo fino nas curvas da Metrópole!',
            time: '23:14',
          },
          {
            id: 'm2',
            sender: 'contact',
            text: 'Lembra de puxar o freio de mão antes de virar pra jogar a traseira em drift limpo.',
            time: '23:15',
          },
          {
            id: 'm3',
            sender: 'contact',
            text: 'Passa na nossa Oficina Tuning se tomar dano. As ferramentas e o Nitro tão liberados!',
            time: '23:18',
          },
        ],
        quickReplies: [
          'Valeu Luca! Tô indo pra Oficina agora.',
          'Quantos cavalos o motor tá rendendo?',
          'Vou testar a linha de drift na chuva!',
        ],
      },
      {
        id: 'miguel',
        name: 'Miguel',
        role: 'Copiloto & Tático',
        avatar: '🧭',
        badgeColor: '#ffd60a',
        unread: true,
        messages: [
          {
            id: 'm4',
            sender: 'contact',
            text: 'Fique esperto no rádio! A polícia tá intensificando bloqueios na Avenida Central.',
            time: '23:20',
          },
          {
            id: 'm5',
            sender: 'contact',
            text: 'Se as viaturas colarem, use as transversais estreitas pra quebrar a linha de visão!',
            time: '23:22',
          },
        ],
        quickReplies: [
          'Deixa comigo, conheço cada atalho!',
          'Onde tem viatura rondando agora?',
          'Vou quebrar os postes pra travar eles!',
        ],
      },
      {
        id: 'sofia',
        name: 'Sofia (Black Market Auto)',
        role: 'Importadora Clandestina',
        avatar: '🔧',
        badgeColor: '#ff0055',
        unread: true,
        messages: [
          {
            id: 'm6',
            sender: 'contact',
            text: 'Acabou de chegar uma remessa de peças japonesas e chassis raros na Concessionária!',
            time: '22:45',
          },
          {
            id: 'm7',
            sender: 'contact',
            text: 'Abre o NetDrift Browser no site underground-auto ou passa lá na loja pra ver o showroom!',
            time: '22:47',
          },
        ],
        quickReplies: [
          'Manda o catálogo pelo celular!',
          'Tô a caminho da Concessionária.',
        ],
      },
      {
        id: 'ghost',
        name: 'Informante X',
        role: 'Scanner Policial',
        avatar: '🕵️',
        badgeColor: '#9d4edd',
        unread: true,
        messages: [
          {
            id: 'm8',
            sender: 'contact',
            text: 'Código 10-41 da LSPD: helicóptero de prontidão em caso de perseguição nível 4.',
            time: '23:30',
          },
          {
            id: 'm9',
            sender: 'contact',
            text: 'Quer zerar as estrelas rápido? Entre na Loja de Conveniência 24/7 ou no Clube Noturno.',
            time: '23:31',
          },
        ],
        quickReplies: [
          'Obrigado pela dica, Informante.',
          'Quanto custa limpar minha ficha?',
        ],
      },
    ];
  }

  private initContracts() {
    this.contracts = [
      {
        id: 'c1',
        title: 'Mestre do Asfalto Molhado',
        targetDesc: 'Acumule 1.200m de drift com pista na chuva ou tempestade',
        rewardCash: 4500,
        rewardRep: 250,
        progress: 450,
        targetMax: 1200,
        isCompleted: false,
        icon: '🌧️',
      },
      {
        id: 'c2',
        title: 'Demolição Urbana',
        targetDesc: 'Destrua 6 postes de luz, semáforos ou árvores em alta velocidade',
        rewardCash: 3500,
        rewardRep: 200,
        progress: 2,
        targetMax: 6,
        isCompleted: false,
        icon: '💥',
      },
      {
        id: 'c3',
        title: 'Topo do Mundo',
        targetDesc: 'Visite a Cobertura Observatório 360° no topo da Torre Central',
        rewardCash: 5000,
        rewardRep: 300,
        progress: 0,
        targetMax: 1,
        isCompleted: false,
        icon: '🏙️',
      },
      {
        id: 'c4',
        title: 'Fuga dos Sonhos',
        targetDesc: 'Fuja com sucesso de uma perseguição policial de nível 3 ou superior',
        rewardCash: 6000,
        rewardRep: 400,
        progress: 1,
        targetMax: 1,
        isCompleted: false,
        icon: '🚨',
      },
    ];
  }

  public setWeatherDisplay(weather: WeatherType) {
    this.currentWeather = weather;
  }

  public open() {
    if (this.isOpen) return;
    this.isOpen = true;
    sound.ensureRunning();
    sound.playCountdownBeep(true);
    this.syncOpenDOM();
    this.callbacks.onOpenStateChanged?.(true);
  }

  public close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    sound.ensureRunning();
    sound.playCountdownBeep(false);
    this.syncOpenDOM();
    this.callbacks.onOpenStateChanged?.(false);
  }

  public setClosedSilently() {
    this.isOpen = false;
    const overlay = this.getOverlayEl();
    overlay?.classList.remove('open');
  }

  public toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  private getOverlayEl(): HTMLElement | null {
    return (
      (this.containerRoot?.querySelector('#smartphoneOverlay') as HTMLElement | null) ||
      document.getElementById('smartphoneOverlay')
    );
  }

  private syncOpenDOM() {
    const overlay = this.getOverlayEl();
    if (overlay) {
      overlay.classList.toggle('open', this.isOpen);
      if (this.isOpen) {
        this.refreshViewport();
      }
    }
  }

  private refreshViewport(options?: { preserveBrowserScroll?: boolean; scrollChatToBottom?: boolean }) {
    const root = this.containerRoot || document.getElementById('smartphoneContainer');
    if (!root) return;
    const viewport = root.querySelector('.phone-screen-viewport') as HTMLElement | null;
    if (!viewport) return;

    const prevBrowserScroll = options?.preserveBrowserScroll
      ? (viewport.querySelector('.browser-webpage-content') as HTMLElement | null)?.scrollTop ?? 0
      : 0;
    const prevViewportScroll = options?.preserveBrowserScroll ? viewport.scrollTop : 0;

    viewport.innerHTML = this.renderAppContent(this.lastPlayerPos);
    this.bindViewportEvents(root);

    if (options?.preserveBrowserScroll) {
      viewport.scrollTop = prevViewportScroll;
      const browserBody = viewport.querySelector('.browser-webpage-content') as HTMLElement | null;
      if (browserBody) browserBody.scrollTop = prevBrowserScroll;
    }

    if (options?.scrollChatToBottom) {
      const chatStream = viewport.querySelector('.chat-stream') as HTMLElement | null;
      if (chatStream) chatStream.scrollTop = chatStream.scrollHeight;
    }
  }

  public openApp(app: SmartphoneApp) {
    this.currentApp = app;
    sound.playCountdownBeep(false);
    this.refreshViewport({ scrollChatToBottom: app === 'messages' });
  }

  public navigateBrowser(url: string) {
    const normalized = this.resolveBrowserUrl(url);
    this.currentUrl = normalized;
    if (this.browserHistory[this.historyIndex] !== normalized) {
      this.browserHistory = this.browserHistory.slice(0, this.historyIndex + 1);
      this.browserHistory.push(normalized);
      this.historyIndex = this.browserHistory.length - 1;
    }
    sound.playCountdownBeep(false);
    this.refreshViewport();
  }

  private resolveBrowserUrl(raw: string): string {
    const val = raw.trim().toLowerCase();
    if (val.includes('auto') || val.includes('import') || val.includes('carro')) return 'drift://underground-auto';
    if (val.includes('lspd') || val.includes('polic') || val.includes('procurad')) return 'drift://lspd-wanted';
    if (val.includes('bleet') || val.includes('social') || val.includes('luca')) return 'drift://bleeter';
    if (val.includes('gazette') || val.includes('news') || val.includes('jornal')) return 'drift://neon-gazette';
    if (val.startsWith('drift://')) {
      const known = [
        'drift://portal',
        'drift://underground-auto',
        'drift://lspd-wanted',
        'drift://bleeter',
        'drift://neon-gazette',
      ];
      return known.includes(val) ? val : 'drift://portal';
    }
    return 'drift://portal';
  }

  public browserBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentUrl = this.browserHistory[this.historyIndex];
      sound.playCountdownBeep(false);
      this.refreshViewport();
    } else {
      this.openApp('home');
    }
  }

  public browserForward() {
    if (this.historyIndex < this.browserHistory.length - 1) {
      this.historyIndex++;
      this.currentUrl = this.browserHistory[this.historyIndex];
      sound.playCountdownBeep(false);
      this.refreshViewport();
    }
  }

  public sendReply(contactId: string, replyText: string) {
    const contact = this.contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    contact.messages.push({
      id: `p_${Date.now()}`,
      sender: 'player',
      text: replyText,
      time,
    });

    sound.playCountdownBeep(true);
    this.refreshViewport({ scrollChatToBottom: true });

    // Automated smart reply after brief delay
    setTimeout(() => {
      const botReplies: Record<string, string> = {
        luca: 'Show de bola, parceiro! Acelera tudo na pista!',
        miguel: 'Entendido, tô de olho nos radares pra você.',
        sofia: 'Perfeito! Se precisar de nitro extra é só chamar.',
        ghost: 'Câmbio, desligando. Fique invisível no trânsito.',
      };
      const response = botReplies[contactId] || 'Mensagem recebida!';
      contact.messages.push({
        id: `c_${Date.now()}`,
        sender: 'contact',
        text: response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
      sound.playDoorEnterSound();
      this.callbacks.onShowToast?.(`💬 ${contact.name}: ${response}`);
      if (this.isOpen && this.currentApp === 'messages' && this.activeChatContactId === contactId) {
        this.refreshViewport({ scrollChatToBottom: true });
      }
    }, 1200);
  }

  public toggleLike(postId: string) {
    if (this.likedPosts.has(postId)) {
      this.likedPosts.delete(postId);
      this.bleeterLikes[postId] = Math.max(0, (this.bleeterLikes[postId] || 1) - 1);
    } else {
      this.likedPosts.add(postId);
      this.bleeterLikes[postId] = (this.bleeterLikes[postId] || 0) + 1;
      sound.playSuccessFanfare();
      this.callbacks.onShowToast?.('❤️ Você curtiu esta publicação no Bleeter!');
    }
    this.refreshViewport({ preserveBrowserScroll: true });
  }

  public claimContract(contractId: string) {
    const c = this.contracts.find((item) => item.id === contractId);
    if (!c || c.progress < c.targetMax || c.isCompleted) return;

    c.isCompleted = true;
    this.profileRef.cash += c.rewardCash;
    this.profileRef.repPoints += c.rewardRep;
    if (this.profileRef.repPoints >= this.profileRef.repLevel * 1000) {
      this.profileRef.repLevel++;
    }
    this.callbacks.onCashBonus?.(c.rewardCash, c.title);
    this.callbacks.onRepBonus?.(c.rewardRep);
    sound.playSuccessFanfare();
    this.callbacks.onShowToast?.(`💰 Contrato Cumprido! +R$ ${c.rewardCash.toLocaleString()} e +${c.rewardRep} REP!`);
    this.refreshViewport();
  }

  public getUnreadCount(): number {
    return this.contacts.filter((c) => c.unread).length;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  public render(playerPos?: { x: number; y: number; z: number }): string {
    if (playerPos) {
      this.lastPlayerPos = { ...playerPos };
    }
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="smartphone-overlay ${this.isOpen ? 'open' : ''}" id="smartphoneOverlay">
        <div class="phone-frame" role="dialog" aria-label="Celular Outlaw 5G">
          <!-- Prominent Top-Right Close Button on .phone-frame -->
          <button
            type="button"
            class="phone-corner-close-btn"
            id="phoneCornerCloseBtn"
            title="Fechar Celular (ESC)"
            aria-label="Fechar Celular"
          >✕</button>

          <!-- Smartphone Top Speaker & Camera Punch-hole -->
          <div class="phone-top-notch">
            <span class="phone-speaker"></span>
            <span class="phone-lens"></span>
          </div>

          <!-- Status Bar with Safe Shield -->
          <div class="phone-status-bar">
            <div class="phone-status-left">
              <span class="phone-clock">${timeStr}</span>
              <span class="phone-carrier">Outlaw 5G</span>
              <span class="phone-safe-shield" title="Jogo protegido enquanto o celular estiver aberto">🛡️ SEGURO</span>
            </div>
            <div class="phone-status-right">
              <span class="phone-battery">98% 🔋</span>
            </div>
          </div>

          <!-- Screen Viewport -->
          <div class="phone-screen-viewport">
            ${this.renderAppContent(this.lastPlayerPos)}
          </div>

          <!-- Bottom Navigation Bar -->
          <div class="phone-nav-bar">
            <button type="button" class="phone-nav-btn" id="phoneBackBtn" title="Voltar">◀ Voltar</button>
            <button type="button" class="phone-nav-btn home-pill" id="phoneHomeBtn" title="Tela Inicial">● Início</button>
            <button type="button" class="phone-nav-btn phone-nav-close" id="phoneCloseBtn" title="Fechar Celular">✕ Sair</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderAppContent(playerPos?: { x: number; y: number; z: number }): string {
    switch (this.currentApp) {
      case 'home':
        return this.renderHomeScreen();
      case 'browser':
        return this.renderBrowserScreen();
      case 'messages':
        return this.renderMessagesScreen();
      case 'contracts':
        return this.renderContractsScreen();
      case 'gps':
        return this.renderGpsScreen(playerPos);
      case 'bank':
        return this.renderBankScreen();
      case 'weather':
        return this.renderWeatherScreen();
      case 'music':
        return this.renderMusicScreen();
      default:
        return this.renderHomeScreen();
    }
  }

  private renderHomeScreen(): string {
    const unread = this.getUnreadCount();
    return `
      <div class="phone-app-home">
        <!-- Home Header Widget -->
        <div class="home-widget-clock">
          <div class="widget-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div class="widget-location">📍 Metrópole Neon · Noite Úmida</div>
          <div class="widget-cash-pill">💵 R$ ${this.profileRef.cash.toLocaleString()} · REP NV.${this.profileRef.repLevel}</div>
        </div>

        <!-- Apps Grid -->
        <div class="phone-apps-grid">
          <button type="button" class="phone-app-icon-item" data-app="browser">
            <div class="app-icon-box browser-icon">🌐</div>
            <span class="app-label">NetDrift</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app="messages">
            <div class="app-icon-box messages-icon">
              💬
              ${unread > 0 ? `<span class="app-badge">${unread}</span>` : ''}
            </div>
            <span class="app-label">ZapDrift</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app="gps">
            <div class="app-icon-box gps-icon">🗺️</div>
            <span class="app-label">GPS Locais</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app="contracts">
            <div class="app-icon-box contracts-icon">🎯</div>
            <span class="app-label">Contratos</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app="bank">
            <div class="app-icon-box bank-icon">💳</div>
            <span class="app-label">OutlawPay</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app="weather">
            <div class="app-icon-box weather-icon">🌦️</div>
            <span class="app-label">Radar Clima</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app="music">
            <div class="app-icon-box music-icon">📻</div>
            <span class="app-label">Rádio FM</span>
          </button>

          <button type="button" class="phone-app-icon-item" data-app-action="call_car">
            <div class="app-icon-box tow-icon">🚗</div>
            <span class="app-label">Guincho / Carro</span>
          </button>
        </div>
      </div>
    `;
  }

  // --- 🌐 NetDrift Browser (Fictional In-Game Internet) ---
  private renderBrowserScreen(): string {
    return `
      <div class="phone-app-browser">
        <!-- Browser Top Bar -->
        <div class="browser-header">
          <div class="browser-controls">
            <button type="button" class="browser-btn" id="bNavBack" ${this.historyIndex <= 0 ? 'disabled' : ''}>◀</button>
            <button type="button" class="browser-btn" id="bNavFwd" ${this.historyIndex >= this.browserHistory.length - 1 ? 'disabled' : ''}>▶</button>
            <button type="button" class="browser-btn" id="bNavRefresh">🔄</button>
          </div>
          <div class="browser-url-bar">
            <span class="ssl-lock">🔒</span>
            <input type="text" class="browser-url-input" id="browserUrlInput" value="${this.currentUrl}" aria-label="Endereço NetDrift" />
          </div>
        </div>

        <!-- Bookmarks Bar -->
        <div class="browser-bookmarks">
          <button type="button" class="bookmark-chip ${this.currentUrl === 'drift://portal' ? 'active' : ''}" data-url="drift://portal">🌐 Portal</button>
          <button type="button" class="bookmark-chip ${this.currentUrl === 'drift://underground-auto' ? 'active' : ''}" data-url="drift://underground-auto">🚗 Import Auto</button>
          <button type="button" class="bookmark-chip ${this.currentUrl === 'drift://lspd-wanted' ? 'active' : ''}" data-url="drift://lspd-wanted">🚨 LSPD Procurados</button>
          <button type="button" class="bookmark-chip ${this.currentUrl === 'drift://bleeter' ? 'active' : ''}" data-url="drift://bleeter">📱 Bleeter</button>
          <button type="button" class="bookmark-chip ${this.currentUrl === 'drift://neon-gazette' ? 'active' : ''}" data-url="drift://neon-gazette">📰 Gazette</button>
        </div>

        <!-- Web Page Content Container -->
        <div class="browser-webpage-content">
          ${this.renderWebpageByUrl(this.currentUrl)}
        </div>
      </div>
    `;
  }

  private renderWebpageByUrl(url: string): string {
    if (url === 'drift://underground-auto') {
      return this.renderUndergroundAutoPage();
    } else if (url === 'drift://lspd-wanted') {
      return this.renderLspdWantedPage();
    } else if (url === 'drift://bleeter') {
      return this.renderBleeterPage();
    } else if (url === 'drift://neon-gazette') {
      return this.renderNeonGazettePage();
    }
    return this.renderPortalPage();
  }

  private renderPortalPage(): string {
    const q = this.portalSearchQuery.trim().toLowerCase();
    const allPortalLinks = [
      {
        url: 'drift://underground-auto',
        tag: 'MERCADO',
        tagClass: 'highlight',
        title: 'Black Market Motors · Importação & Nitro',
        desc: 'Novo lote de motores Twin-Turbo e suspensões de ângulo extremo chega à Concessionária.',
        keywords: 'carro carros auto motor drift turbo oficina concessionaria import',
      },
      {
        url: 'drift://lspd-wanted',
        tag: 'POLICIAL',
        tagClass: '',
        title: 'LSPD Procurados · Painel da Patrulha',
        desc: 'Mais de 15 viaturas e furgões blindados deslocados para vigiar os viadutos da Avenida Central.',
        keywords: 'policia lspd procurado viatura swat bloqueio estrela fuga',
      },
      {
        url: 'drift://bleeter',
        tag: 'VIRAL',
        tagClass: 'viral',
        title: 'Bleeter Social · Luca & Miguel Viralizam',
        desc: 'Luca & Miguel gravam clipe derrapando a 180 km/h na chuva e ultrapassam 100 mil curtidas.',
        keywords: 'bleeter social luca miguel drift chuva post rede pontos',
      },
      {
        url: 'drift://neon-gazette',
        tag: 'JORNAL',
        tagClass: '',
        title: 'Neon Gazette · Edição da Meia-Noite',
        desc: 'Rachas noturnos: o fenômeno do submundo automotivo que domina Metrópole Neon.',
        keywords: 'jornal gazette noticia racha metropole neon cidade',
      },
    ];

    const filteredLinks = q
      ? allPortalLinks.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.desc.toLowerCase().includes(q) ||
            item.keywords.includes(q)
        )
      : allPortalLinks;

    return `
      <div class="webpage-portal">
        <div class="portal-hero">
          <h2 class="portal-logo">EYEFIND<span>.drift</span></h2>
          <p class="portal-tagline">O portal nº 1 do submundo automotivo e corridas noturnas</p>
          <div class="portal-search-box">
            <input type="text" id="portalSearchInput" class="portal-search-input" value="${this.escapeHtml(this.portalSearchQuery)}" placeholder="Buscar: drift, polícia, carros, luca..." />
            <button type="button" id="portalSearchBtn" class="portal-search-btn">🔍 Pesquisar</button>
          </div>
        </div>

        <div class="portal-section-title">${q ? `🔎 RESULTADOS PARA "${this.escapeHtml(this.portalSearchQuery.toUpperCase())}"` : '🔥 TENDÊNCIAS DA NOITE'}</div>
        <div class="portal-news-list">
          ${
            filteredLinks.length > 0
              ? filteredLinks
                  .map(
                    (item) => `
              <div class="portal-news-card" data-url="${item.url}">
                <span class="news-tag ${item.tagClass}">${item.tag}</span>
                <h4>${item.title}</h4>
                <p>${item.desc}</p>
              </div>
            `
                  )
                  .join('')
              : `<div class="portal-empty-search">Nenhum site encontrado para "${this.escapeHtml(this.portalSearchQuery)}". <button type="button" class="portal-reset-search-btn" id="portalResetSearchBtn">Limpar busca</button></div>`
          }
        </div>
      </div>
    `;
  }

  private renderUndergroundAutoPage(): string {
    return `
      <div class="webpage-auto">
        <div class="auto-header">
          <div class="auto-brand">BLACK MARKET MOTORS 🏁</div>
          <p>Importação direta · Sem burocracia · Prontos para as ruas</p>
        </div>

        <div class="auto-deals-grid">
          <div class="auto-card">
            <div class="auto-thumb-box">🏎️</div>
            <div class="auto-details">
              <h4>Apex GT-R Spec-R</h4>
              <span class="auto-specs">Twin-Turbo · 620 HP · Tração Traseira</span>
              <div class="auto-price">R$ 48.000</div>
              <button type="button" class="auto-buy-btn" data-action="fast_travel_dealer">📍 VISITAR NO SHOWROOM</button>
            </div>
          </div>

          <div class="auto-card">
            <div class="auto-thumb-box">🔥</div>
            <div class="auto-details">
              <h4>Venom Silvia Drift S15</h4>
              <span class="auto-specs">Ângulo 65° · 520 HP · Gaiola FIA</span>
              <div class="auto-price">R$ 36.000</div>
              <button type="button" class="auto-buy-btn" data-action="fast_travel_dealer">📍 VISITAR NO SHOWROOM</button>
            </div>
          </div>

          <div class="auto-card">
            <div class="auto-thumb-box">⚡</div>
            <div class="auto-details">
              <h4>Kit Garagem: Recarga Instantânea Nitro</h4>
              <span class="auto-specs">Disponível na Oficina de Luca & Miguel</span>
              <div class="auto-price">GRÁTIS (Membros)</div>
              <button type="button" class="auto-buy-btn" data-action="fast_travel_garage">📍 IR PARA OFICINA</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderLspdWantedPage(): string {
    return `
      <div class="webpage-police">
        <div class="police-header">
          <div class="police-shield">🛡️ LSPD DATABASE</div>
          <h3>POLÍCIA METROPOLITANA · PAINEL DE PROCURADOS</h3>
          <p>Alerta Geral para todas as Unidades da Patrulha Rodoviária</p>
        </div>

        <div class="wanted-hero-box">
          <div class="wanted-mugshot">👤</div>
          <div class="wanted-info">
            <span class="wanted-level-badge">PRIORIDADE ALTA</span>
            <h4>ALVO: "O PILOTO OUTLAW"</h4>
            <p><strong>Crimes:</strong> Direção perigosa, excesso de velocidade, destruição de patrimônio público (postes e semáforos), evasão de bloqueios.</p>
            <div class="wanted-bounty">RECOMPENSA: R$ 25.000</div>
          </div>
        </div>

        <div class="police-tips-box">
          <h4>PROTOCOLO DE PATRULHA:</h4>
          <ul>
            <li>Nível 1-2: Viaturas sedan Crown interceptadoras.</li>
            <li>Nível 3: Bloqueios táticos de barricada com spikes.</li>
            <li>Nível 4-5: Furgões SWAT blindados e manobras PIT agressivas.</li>
          </ul>
        </div>
      </div>
    `;
  }

  private renderBleeterPage(): string {
    return `
      <div class="webpage-bleeter">
        <div class="bleeter-header">
          <h3>bleeter.drift</h3>
          <span>O feed de quem não dorme</span>
        </div>

        <div class="bleeter-feed">
          <div class="bleet-post">
            <div class="bleet-author">
              <span class="bleet-avatar">🏎️</span>
              <div>
                <strong>Luca</strong> <span class="bleet-handle">@Luca_Apex</span>
              </div>
            </div>
            <p class="bleet-body">A pista molhada da chuva tá surreal pra treinar transição de peso! Quem tiver pela Avenida Oeste encosta pra puxar tandem!</p>
            <div class="bleet-actions">
              <button type="button" class="bleet-like-btn ${this.likedPosts.has('post1') ? 'liked' : ''}" data-post-id="post1">
                ❤️ ${this.bleeterLikes.post1 || 342}
              </button>
              <span class="bleet-reply-btn">💬 48</span>
              <span class="bleet-share-btn">🔁 89</span>
            </div>
          </div>

          <div class="bleet-post">
            <div class="bleet-author">
              <span class="bleet-avatar">🧭</span>
              <div>
                <strong>Miguel</strong> <span class="bleet-handle">@Miguel_Turbo</span>
              </div>
            </div>
            <p class="bleet-body">Se alguém bater o recorde da Cobertura Observatório hoje eu pago o café de todo mundo no Midnight Diner 24h! Desafio lançado!</p>
            <div class="bleet-actions">
              <button type="button" class="bleet-like-btn ${this.likedPosts.has('post2') ? 'liked' : ''}" data-post-id="post2">
                ❤️ ${this.bleeterLikes.post2 || 1289}
              </button>
              <span class="bleet-reply-btn">💬 154</span>
              <span class="bleet-share-btn">🔁 312</span>
            </div>
          </div>

          <div class="bleet-post">
            <div class="bleet-author">
              <span class="bleet-avatar">👮</span>
              <div>
                <strong>Sargento Rocha</strong> <span class="bleet-handle">@LSPD_Rocha</span>
              </div>
            </div>
            <p class="bleet-body">Aviso aos "pilotos" da noite: os radares novos não perdoam. Destruir semáforo dá cadeia. Estamos de olho.</p>
            <div class="bleet-actions">
              <button type="button" class="bleet-like-btn ${this.likedPosts.has('post3') ? 'liked' : ''}" data-post-id="post3">
                ❤️ ${this.bleeterLikes.post3 || 567}
              </button>
              <span class="bleet-reply-btn">💬 402</span>
              <span class="bleet-share-btn">🔁 67</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderNeonGazettePage(): string {
    return `
      <div class="webpage-gazette">
        <div class="gazette-header">
          <h1>NEON GAZETTE</h1>
          <div class="gazette-sub">Edição Extraordinária da Meia-Noite</div>
        </div>
        <article class="gazette-article">
          <h3>RACHAS NOTURNOS: O FENÔMENO QUE A POLÍCIA NÃO CONSEGUE CONTER</h3>
          <p>Com viadutos elevados e retas iluminadas por neons pulsantes, a cidade se transformou na capital mundial do drift de rua. Pilotos anônimos usam a nova rede "ZapDrift" para marcar encontros relâmpago antes que os rádios policiais consigam triangular as posições.</p>
          <blockquote>"Eles não estão apenas correndo; criaram uma cultura completa com pontos de encontro, oficinas e códigos de conduta." — Especialista em Tráfego Urbano</blockquote>
        </article>
      </div>
    `;
  }

  // --- 💬 ZapDrift Messages App ---
  private renderMessagesScreen(): string {
    const contact = this.contacts.find((c) => c.id === this.activeChatContactId) || this.contacts[0];

    return `
      <div class="phone-app-messages">
        <!-- Contacts Strip -->
        <div class="messages-contacts-bar">
          ${this.contacts
            .map(
              (c) => `
            <button type="button" class="contact-tab-btn ${c.id === contact.id ? 'active' : ''}" data-contact-id="${c.id}">
              <span class="contact-tab-avatar">${c.avatar}</span>
              <span class="contact-tab-name">${c.name}</span>
            </button>
          `
            )
            .join('')}
        </div>

        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-header-avatar">${contact.avatar}</div>
          <div class="chat-header-info">
            <div class="chat-header-name">${contact.name}</div>
            <div class="chat-header-status">🟢 Online · ${contact.role}</div>
          </div>
        </div>

        <!-- Message Bubbles Stream -->
        <div class="chat-stream">
          ${contact.messages
            .map(
              (m) => `
            <div class="chat-bubble ${m.sender === 'player' ? 'player-bubble' : 'contact-bubble'}">
              <div class="bubble-text">${m.text}</div>
              <div class="bubble-time">${m.time}</div>
            </div>
          `
            )
            .join('')}
        </div>

        <!-- Quick Interactive Replies -->
        <div class="chat-quick-replies">
          ${contact.quickReplies
            .map(
              (reply) => `
            <button type="button" class="quick-reply-chip" data-reply="${reply}" data-contact="${contact.id}">
              💬 ${reply}
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  // --- 🗺️ GPS & Accessible Locations Guide ---
  private renderGpsScreen(playerPos?: { x: number; y: number; z: number }): string {
    const locations = [
      {
        id: 'la_casa_de_hermanos',
        name: 'La Casa de Hermanos · Mansão Luca & Miguel',
        desc: 'Mansão de mafioso de Luca & Miguel · Cofre (+R$ 3.500 & +120 REP), Saúde e Nitro',
        icon: '🎩',
        coords: { x: 78, y: 0, z: 56, heading: Math.PI / 2 },
      },
      {
        id: 'tuning_garage',
        name: 'Oficina Tuning · Luca & Miguel',
        desc: 'Safehouse principal · Reparo total e recarga de Nitro',
        icon: '🔧',
        coords: { x: -65, y: 0, z: 18, heading: Math.PI / 2 },
      },
      {
        id: 'residential_house',
        name: 'Casa de Luca & Miguel',
        desc: 'Sobrado residencial com sala, TV de telemetria e descanso (+50 REP)',
        icon: '🏠',
        coords: { x: -196, y: 0, z: 110, heading: Math.PI },
      },
      {
        id: 'midnight_diner',
        name: 'Midnight Drift Diner 24h',
        desc: 'Restaurante retro neon · Café Turbo com adrenalina e nitro infinito',
        icon: '☕',
        coords: { x: 92, y: 0, z: -82, heading: -Math.PI / 2 },
      },
      {
        id: 'skyline_observatory',
        name: 'Torre Central & Cobertura Observatório',
        desc: 'Elevador expresso para terraço panorâmico a 85m de altura (+100 REP)',
        icon: '🏙️',
        coords: { x: 72, y: 0, z: 110, heading: 0 },
      },
      {
        id: 'black_market_motors',
        name: 'Concessionária Black Market Motors',
        desc: 'Showroom de supercarros importados e peças de alta performance',
        icon: '🏎️',
        coords: { x: 120, y: 0, z: -140, heading: Math.PI / 2 },
      },
      {
        id: 'underground_club',
        name: 'Clube Noturno Underground (The Line)',
        desc: 'Boate subterrânea com painel de LED, pista de dança e boost musical',
        icon: '🪩',
        coords: { x: -106, y: 0, z: -120, heading: -Math.PI / 2 },
      },
      {
        id: 'highway_mart_247',
        name: 'Posto SpeedWay 24/7 & Conveniência',
        desc: 'Bombas de combustível, mercado e resfriamento de estrelas de perseguição',
        icon: '⛽',
        coords: { x: -35, y: 0, z: 120, heading: 0 },
      },
    ];

    return `
      <div class="phone-app-gps">
        <div class="gps-header">
          <h3>GUIA GPS DE LOCAIS ACESSÍVEIS</h3>
          <p>Selecione um ponto de interesse para marcar ou viajar rapidamente</p>
        </div>

        <div class="gps-list">
          ${locations
            .map((loc) => {
              let distText = '-- m';
              if (playerPos) {
                const dx = loc.coords.x - playerPos.x;
                const dz = loc.coords.z - playerPos.z;
                const dist = Math.round(Math.hypot(dx, dz));
                distText = `${dist}m`;
              }
              return `
              <div class="gps-card">
                <div class="gps-card-icon">${loc.icon}</div>
                <div class="gps-card-body">
                  <h4>${loc.name}</h4>
                  <p>${loc.desc}</p>
                  <div class="gps-distance-tag">Distância: <strong>${distText}</strong></div>
                </div>
                <div class="gps-actions">
                  <button type="button" class="gps-fast-travel-btn" data-coords='${JSON.stringify(loc.coords)}' data-name="${loc.name}">
                    ⚡ VIAJAR
                  </button>
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // --- 🎯 Bounties / Contracts App ---
  private renderContractsScreen(): string {
    return `
      <div class="phone-app-contracts">
        <div class="contracts-header">
          <h3>CONTRATOS DE RUA</h3>
          <p>Cumpra objetivos na cidade para receber Recompensas & REP</p>
        </div>

        <div class="contracts-list">
          ${this.contracts
            .map((c) => {
              const pct = Math.min(100, Math.round((c.progress / c.targetMax) * 100));
              const ready = c.progress >= c.targetMax && !c.isCompleted;
              return `
              <div class="contract-card ${ready ? 'ready' : ''} ${c.isCompleted ? 'claimed' : ''}">
                <div class="contract-top">
                  <span class="contract-icon">${c.icon}</span>
                  <div class="contract-titles">
                    <h4>${c.title}</h4>
                    <span class="contract-reward">R$ +${c.rewardCash.toLocaleString()} · +${c.rewardRep} REP</span>
                  </div>
                </div>
                <p class="contract-desc">${c.targetDesc}</p>
                <div class="contract-prog-bar">
                  <div class="contract-prog-fill" style="width: ${pct}%;"></div>
                </div>
                <div class="contract-footer">
                  <span class="contract-counts">${c.progress} / ${c.targetMax}</span>
                  ${
                    c.isCompleted
                      ? `<span class="contract-status-pill claimed-pill">✅ RESGATADO</span>`
                      : ready
                        ? `<button type="button" class="contract-claim-btn" data-contract-id="${c.id}">RECEBER PRÊMIO</button>`
                        : `<span class="contract-status-pill">EM PROGRESSO (${pct}%)</span>`
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      </div>
    `;
  }

  // --- 💳 Bank App ---
  private renderBankScreen(): string {
    return `
      <div class="phone-app-bank">
        <div class="bank-card-visual">
          <div class="card-chip"></div>
          <div class="card-brand">OUTLAW BLACK CARD</div>
          <div class="card-number">•••• •••• •••• 4092</div>
          <div class="card-balance">SALDO: R$ ${this.profileRef.cash.toLocaleString()}</div>
          <div class="card-holder">${this.profileRef.name.toUpperCase()}</div>
        </div>

        <div class="bank-stats-grid">
          <div class="bank-stat-box">
            <span>NÍVEL DE REP</span>
            <strong>${this.profileRef.repLevel}</strong>
          </div>
          <div class="bank-stat-box">
            <span>PONTOS DE REP</span>
            <strong>${this.profileRef.repPoints}</strong>
          </div>
          <div class="bank-stat-box">
            <span>FUGAS BEM SUCEDIDAS</span>
            <strong>${this.profileRef.totalEscapes}</strong>
          </div>
        </div>

        <div class="bank-section-title">ÚLTIMAS TRANSAÇÕES</div>
        <div class="bank-trans-list">
          <div class="trans-item positive">
            <span>+ R$ 2.500</span>
            <small>Bônus de Drift Noturno</small>
          </div>
          <div class="trans-item negative">
            <span>- R$ 500</span>
            <small>Compra no Midnight Diner</small>
          </div>
          <div class="trans-item positive">
            <span>+ R$ 5.000</span>
            <small>Fuga da Patrulha Rodoviária</small>
          </div>
        </div>
      </div>
    `;
  }

  // --- 🌦️ Weather Radar App ---
  private renderWeatherScreen(): string {
    const weatherMeta: Record<WeatherType, { icon: string; temp: string; desc: string }> = {
      sunny: {
        icon: '☀️',
        temp: '27°C · Céu Limpo',
        desc: 'Asfalto seco com aderência máxima (100% Grip). Ideal para velocidade final.',
      },
      rain: {
        icon: '🌧️',
        temp: '19°C · Chuva Fina',
        desc: 'Asfalto molhado com redução de aderência (-25% Grip). Drift facilitado.',
      },
      storm: {
        icon: '⚡',
        temp: '16°C · Tempestade Severa',
        desc: 'Chuva intensa e relâmpagos (-35% Grip). Curvas exigem controle fino.',
      },
      fog: {
        icon: '🌫️',
        temp: '14°C · Neblina Densa',
        desc: 'Visibilidade reduzida nas avenidas e aderência levemente úmida (-15% Grip).',
      },
    };
    const meta = weatherMeta[this.currentWeather] || weatherMeta.rain;

    return `
      <div class="phone-app-weather">
        <div class="weather-current-card">
          <div class="weather-big-icon">${meta.icon}</div>
          <h2>METRÓPOLE NEON</h2>
          <div class="weather-temp">${meta.temp}</div>
          <p>${meta.desc}</p>
        </div>

        <div class="weather-selector-title">ALTERAR CLIMA DA CIDADE</div>
        <div class="weather-buttons-grid">
          <button type="button" class="weather-preset-btn ${this.currentWeather === 'sunny' ? 'active' : ''}" data-set-weather="sunny">
            ☀️ Ensolarado
          </button>
          <button type="button" class="weather-preset-btn ${this.currentWeather === 'rain' ? 'active' : ''}" data-set-weather="rain">
            🌧️ Chuva (-25% Grip)
          </button>
          <button type="button" class="weather-preset-btn ${this.currentWeather === 'storm' ? 'active' : ''}" data-set-weather="storm">
            ⚡ Tempestade (-35% Grip)
          </button>
          <button type="button" class="weather-preset-btn ${this.currentWeather === 'fog' ? 'active' : ''}" data-set-weather="fog">
            🌫️ Neblina Densa
          </button>
        </div>
      </div>
    `;
  }

  // --- 📻 Radio App ---
  private renderMusicScreen(): string {
    const activeChannel = this.radioChannels[this.activeRadioChannelIndex] || this.radioChannels[0];
    return `
      <div class="phone-app-music">
        <div class="music-visualizer ${this.isRadioPlaying ? '' : 'is-paused'}">
          <span class="v-bar"></span>
          <span class="v-bar"></span>
          <span class="v-bar"></span>
          <span class="v-bar"></span>
          <span class="v-bar"></span>
        </div>
        <h3>OUTLAW DRIFT FM</h3>
        <p class="now-playing">${this.isRadioPlaying ? `Tocando: ${activeChannel.track}` : 'Rádio em Pausa'}</p>
        <button type="button" class="music-play-toggle-btn" id="btnToggleRadioPlay">
          ${this.isRadioPlaying ? '⏸ Pausar Rádio' : '▶ Tocar Rádio'}
        </button>

        <div class="music-channels-list">
          ${this.radioChannels
            .map(
              (ch, idx) => `
            <button type="button" class="music-channel-chip ${idx === this.activeRadioChannelIndex ? 'active' : ''}" data-radio-index="${idx}">
              ${ch.label}
            </button>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  public bindDOMEvents(root: HTMLElement) {
    this.containerRoot = root;

    // Backdrop click outside phone frame closes the phone cleanly
    const overlay = root.querySelector('#smartphoneOverlay') as HTMLElement | null;
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });

    // Top-right corner prominent Close button on .phone-frame
    root.querySelector('#phoneCornerCloseBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Bottom Nav bar buttons (bound once per frame render)
    root.querySelector('#phoneHomeBtn')?.addEventListener('click', () => {
      this.openApp('home');
    });

    root.querySelector('#phoneCloseBtn')?.addEventListener('click', () => {
      this.close();
    });

    root.querySelector('#phoneBackBtn')?.addEventListener('click', () => {
      if (this.currentApp === 'browser') {
        this.browserBack();
      } else if (this.currentApp !== 'home') {
        this.openApp('home');
      } else {
        this.close();
      }
    });

    this.bindViewportEvents(root);
  }

  private bindViewportEvents(root: HTMLElement) {
    // App launch buttons
    root.querySelectorAll('[data-app]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const app = btn.getAttribute('data-app') as SmartphoneApp;
        if (app) this.openApp(app);
      });
    });

    // Call car / tow truck action
    root.querySelector('[data-app-action="call_car"]')?.addEventListener('click', () => {
      sound.playWrenchToolSound();
      this.callbacks.onSpawnCar?.('car');
      this.callbacks.onShowToast?.('🚗 Veículo alinhado e entregue na sua posição!');
      this.close();
    });

    // Browser navigation & bookmarks
    root.querySelectorAll('[data-url]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        if (url) {
          this.currentApp = 'browser';
          this.navigateBrowser(url);
        }
      });
    });

    root.querySelector('#bNavBack')?.addEventListener('click', () => this.browserBack());
    root.querySelector('#bNavFwd')?.addEventListener('click', () => this.browserForward());
    root.querySelector('#bNavRefresh')?.addEventListener('click', () => {
      sound.playCountdownBeep(false);
      this.refreshViewport();
    });

    const urlInput = root.querySelector('#browserUrlInput') as HTMLInputElement | null;
    urlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.navigateBrowser(urlInput.value);
      }
    });

    const portalSearchInput = root.querySelector('#portalSearchInput') as HTMLInputElement | null;
    const runPortalSearch = () => {
      this.portalSearchQuery = portalSearchInput?.value || '';
      sound.playCountdownBeep(false);
      this.refreshViewport();
    };
    root.querySelector('#portalSearchBtn')?.addEventListener('click', runPortalSearch);
    portalSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runPortalSearch();
      }
    });
    root.querySelector('#portalResetSearchBtn')?.addEventListener('click', () => {
      this.portalSearchQuery = '';
      this.refreshViewport();
    });

    // Bleeter likes
    root.querySelectorAll('[data-post-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-post-id');
        if (id) this.toggleLike(id);
      });
    });

    // Auto dealer actions
    root.querySelectorAll('[data-action="fast_travel_dealer"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onFastTravel?.({ x: 120, y: 0, z: -140, heading: Math.PI / 2 });
        this.callbacks.onShowToast?.('🏎️ Viajando para Concessionária Black Market Motors...');
        this.close();
      });
    });

    root.querySelectorAll('[data-action="fast_travel_garage"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onFastTravel?.({ x: -65, y: 0, z: 18, heading: Math.PI / 2 });
        this.callbacks.onShowToast?.('🔧 Viajando para Oficina Tuning...');
        this.close();
      });
    });

    // Chat tabs & quick replies
    root.querySelectorAll('[data-contact-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-contact-id');
        if (cid) {
          this.activeChatContactId = cid;
          const c = this.contacts.find((item) => item.id === cid);
          if (c) c.unread = false;
          sound.playCountdownBeep(false);
          this.refreshViewport({ scrollChatToBottom: true });
        }
      });
    });

    root.querySelectorAll('[data-reply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reply = btn.getAttribute('data-reply');
        const contactId = btn.getAttribute('data-contact');
        if (reply && contactId) {
          this.sendReply(contactId, reply);
        }
      });
    });

    // GPS Fast Travel buttons
    root.querySelectorAll('.gps-fast-travel-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const coordsStr = btn.getAttribute('data-coords');
        const name = btn.getAttribute('data-name');
        if (coordsStr) {
          try {
            const coords = JSON.parse(coordsStr);
            this.callbacks.onFastTravel?.(coords);
            this.callbacks.onShowToast?.(`⚡ Viagem rápida realizada para: ${name}!`);
            this.close();
          } catch (e) {
            console.error('Error fast travel:', e);
          }
        }
      });
    });

    // Contract claims
    root.querySelectorAll('[data-contract-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.getAttribute('data-contract-id');
        if (cid) {
          this.claimContract(cid);
        }
      });
    });

    // Weather preset buttons
    root.querySelectorAll('[data-set-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-set-weather') as WeatherType;
        if (w) {
          this.currentWeather = w;
          this.callbacks.onSetWeather?.(w);
          this.callbacks.onShowToast?.(`🌦️ Clima alterado para: ${w.toUpperCase()}`);
          this.refreshViewport();
        }
      });
    });

    // Radio FM channel selection & play/pause
    root.querySelector('#btnToggleRadioPlay')?.addEventListener('click', () => {
      this.isRadioPlaying = !this.isRadioPlaying;
      sound.playCountdownBeep(this.isRadioPlaying);
      this.callbacks.onShowToast?.(
        this.isRadioPlaying ? '📻 Rádio Outlaw Drift FM ligada!' : '🔇 Rádio em pausa.'
      );
      this.refreshViewport();
    });

    root.querySelectorAll('[data-radio-index]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idxStr = btn.getAttribute('data-radio-index');
        const idx = idxStr ? parseInt(idxStr, 10) : 0;
        if (!Number.isNaN(idx) && this.radioChannels[idx]) {
          this.activeRadioChannelIndex = idx;
          this.isRadioPlaying = true;
          sound.playCountdownBeep(true);
          this.callbacks.onShowToast?.(`📻 Sintonizado em ${this.radioChannels[idx].label}`);
          this.refreshViewport();
        }
      });
    });
  }
}
