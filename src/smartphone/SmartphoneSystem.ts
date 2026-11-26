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

  public toggle() {
    this.isOpen = !this.isOpen;
    sound.ensureRunning();
    if (this.isOpen) {
      sound.playCountdownBeep(true);
    } else {
      sound.playCountdownBeep(false);
    }
  }

  public openApp(app: SmartphoneApp) {
    this.currentApp = app;
    sound.playCountdownBeep(false);
  }

  public navigateBrowser(url: string) {
    this.currentUrl = url;
    if (this.browserHistory[this.historyIndex] !== url) {
      this.browserHistory = this.browserHistory.slice(0, this.historyIndex + 1);
      this.browserHistory.push(url);
      this.historyIndex = this.browserHistory.length - 1;
    }
    sound.playCountdownBeep(false);
  }

  public browserBack() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.currentUrl = this.browserHistory[this.historyIndex];
      sound.playCountdownBeep(false);
    }
  }

  public browserForward() {
    if (this.historyIndex < this.browserHistory.length - 1) {
      this.historyIndex++;
      this.currentUrl = this.browserHistory[this.historyIndex];
      sound.playCountdownBeep(false);
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
  }

  public claimContract(contractId: string) {
    const c = this.contracts.find((item) => item.id === contractId);
    if (!c || !c.isCompleted) return;

    this.profileRef.cash += c.rewardCash;
    this.profileRef.repPoints += c.rewardRep;
    sound.playSuccessFanfare();
    this.callbacks.onShowToast?.(`💰 Contrato Cumprido! +R$ ${c.rewardCash} e +${c.rewardRep} REP!`);
    c.isCompleted = false;
    c.progress = 0;
  }

  public getUnreadCount(): number {
    return this.contacts.filter((c) => c.unread).length;
  }

  public render(playerPos?: { x: number; y: number; z: number }): string {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const unread = this.getUnreadCount();

    return `
      <div class="smartphone-overlay ${this.isOpen ? 'open' : ''}" id="smartphoneOverlay">
        <div class="phone-frame">
          <!-- Smartphone Top Speaker & Camera Punch-hole -->
          <div class="phone-top-notch">
            <span class="phone-speaker"></span>
            <span class="phone-lens"></span>
          </div>

          <!-- Status Bar -->
          <div class="phone-status-bar">
            <div class="phone-status-left">
              <span class="phone-clock">${timeStr}</span>
              <span class="phone-carrier">Outlaw 5G</span>
            </div>
            <div class="phone-status-right">
              <span class="phone-status-icon">📶</span>
              <span class="phone-status-icon">📡</span>
              <span class="phone-battery">98% 🔋</span>
            </div>
          </div>

          <!-- Screen Viewport -->
          <div class="phone-screen-viewport">
            ${this.renderAppContent(playerPos)}
          </div>

          <!-- Bottom Navigation Bar -->
          <div class="phone-nav-bar">
            <button type="button" class="phone-nav-btn" id="phoneBackBtn" title="Voltar">◀</button>
            <button type="button" class="phone-nav-btn home-pill" id="phoneHomeBtn" title="Início">●</button>
            <button type="button" class="phone-nav-btn" id="phoneCloseBtn" title="Fechar Celular">✕</button>
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
            <input type="text" class="browser-url-input" id="browserUrlInput" value="${this.currentUrl}" readonly />
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
    return `
      <div class="webpage-portal">
        <div class="portal-hero">
          <h2 class="portal-logo">EYEFIND<span>.drift</span></h2>
          <p class="portal-tagline">O portal nº 1 do submundo automotivo e corridas noturnas</p>
          <div class="portal-search-box">
            <input type="text" class="portal-search-input" value="melhores pontos de drift metropole neon" readonly />
            <button type="button" class="portal-search-btn">🔍 Pesquisar</button>
          </div>
        </div>

        <div class="portal-section-title">🔥 TENDÊNCIAS DA NOITE</div>
        <div class="portal-news-list">
          <div class="portal-news-card" data-url="drift://neon-gazette">
            <span class="news-tag">POLICIAL</span>
            <h4>Comandante da LSPD promete tolerância zero para rachas na Avenida Central</h4>
            <p>Mais de 15 viaturas e furgões blindados foram deslocados para vigiar os viadutos após evento clandestino.</p>
          </div>

          <div class="portal-news-card" data-url="drift://underground-auto">
            <span class="news-tag highlight">MERCADO</span>
            <h4>Novo lote de motores Twin-Turbo e suspensões de ângulo extremo chega à Concessionária</h4>
            <p>Sofia anuncia descontos exclusivos para pilotos com reputação acima de Nível 3.</p>
          </div>

          <div class="portal-news-card" data-url="drift://bleeter">
            <span class="news-tag viral">VIRAL</span>
            <h4>Luca & Miguel gravam clipe derrapando a 180 km/h na chuva e viralizam no Bleeter</h4>
            <p>Vídeo ultrapassou 100 mil compartilhamentos em menos de duas horas.</p>
          </div>
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
        coords: { x: -176, y: 0, z: 110, heading: Math.PI },
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
              const ready = c.progress >= c.targetMax;
              return `
              <div class="contract-card ${ready ? 'ready' : ''}">
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
                    ready
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
    return `
      <div class="phone-app-weather">
        <div class="weather-current-card">
          <div class="weather-big-icon">🌧️</div>
          <h2>METRÓPOLE NEON</h2>
          <div class="weather-temp">19°C · Chuva Fina</div>
          <p>Asfalto molhado com redução de aderência. Drift facilitado.</p>
        </div>

        <div class="weather-selector-title">ALTERAR CLIMA DA CIDADE</div>
        <div class="weather-buttons-grid">
          <button type="button" class="weather-preset-btn" data-set-weather="sunny">
            ☀️ Ensolarado
          </button>
          <button type="button" class="weather-preset-btn" data-set-weather="rain">
            🌧️ Chuva (-25% Grip)
          </button>
          <button type="button" class="weather-preset-btn" data-set-weather="storm">
            ⚡ Tempestade (-35% Grip)
          </button>
          <button type="button" class="weather-preset-btn" data-set-weather="fog">
            🌫️ Neblina Densa
          </button>
        </div>
      </div>
    `;
  }

  // --- 📻 Radio App ---
  private renderMusicScreen(): string {
    return `
      <div class="phone-app-music">
        <div class="music-visualizer">
          <span class="v-bar"></span>
          <span class="v-bar"></span>
          <span class="v-bar"></span>
          <span class="v-bar"></span>
          <span class="v-bar"></span>
        </div>
        <h3>OUTLAW DRIFT FM</h3>
        <p class="now-playing">Tocando: Midnight Phonk & Synthwave 24/7</p>

        <div class="music-channels-list">
          <button type="button" class="music-channel-chip active">📻 104.2 Neon Waves (Synth)</button>
          <button type="button" class="music-channel-chip">🔥 98.7 Tokyo Drift Phonk</button>
          <button type="button" class="music-channel-chip">⚡ 106.9 Cyberpunk Bass D&B</button>
          <button type="button" class="music-channel-chip">🕶️ 92.5 Underground Hip-Hop</button>
        </div>
      </div>
    `;
  }

  public bindDOMEvents(root: HTMLElement) {
    // Nav bar buttons
    root.querySelector('#phoneHomeBtn')?.addEventListener('click', () => {
      this.openApp('home');
    });

    root.querySelector('#phoneCloseBtn')?.addEventListener('click', () => {
      this.toggle();
    });

    root.querySelector('#phoneBackBtn')?.addEventListener('click', () => {
      if (this.currentApp === 'browser') {
        this.browserBack();
      } else {
        this.openApp('home');
      }
    });

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
      this.callbacks.onShowToast?.('🚗 Veículo alinhado e entregue na sua posição!');
      this.callbacks.onSpawnCar?.('car');
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
      this.navigateBrowser(this.currentUrl);
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
        this.toggle();
      });
    });

    root.querySelectorAll('[data-action="fast_travel_garage"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.callbacks.onFastTravel?.({ x: -65, y: 0, z: 18, heading: Math.PI / 2 });
        this.callbacks.onShowToast?.('🔧 Viajando para Oficina Tuning...');
        this.toggle();
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
          // Rerender chat stream
          const screen = root.querySelector('.phone-screen-viewport');
          if (screen) screen.innerHTML = this.renderAppContent();
          this.bindDOMEvents(root);
        }
      });
    });

    root.querySelectorAll('[data-reply]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const reply = btn.getAttribute('data-reply');
        const contactId = btn.getAttribute('data-contact');
        if (reply && contactId) {
          this.sendReply(contactId, reply);
          // Rerender chat stream
          const screen = root.querySelector('.phone-screen-viewport');
          if (screen) screen.innerHTML = this.renderAppContent();
          this.bindDOMEvents(root);
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
            this.toggle();
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
          const screen = root.querySelector('.phone-screen-viewport');
          if (screen) screen.innerHTML = this.renderAppContent();
          this.bindDOMEvents(root);
        }
      });
    });

    // Weather preset buttons
    root.querySelectorAll('[data-set-weather]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const w = btn.getAttribute('data-set-weather') as WeatherType;
        if (w) {
          this.callbacks.onSetWeather?.(w);
          this.callbacks.onShowToast?.(`🌦️ Clima alterado para: ${w.toUpperCase()}`);
        }
      });
    });
  }
}
