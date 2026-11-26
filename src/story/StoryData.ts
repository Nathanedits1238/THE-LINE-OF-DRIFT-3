import { DialogueLine, StoryChapter, StoryEndingId, StoryEndingInfo } from '../types';

export const CAREER_COPILOTS: string[] = [
  'Nina "Apex"',
  'Alan "Vanguard"',
  'André "Andreiwalt"',
  'Ana "Sombra"',
];

export function getCareerFilmCutscenes(
  pilotName: string,
  pilotNick: string,
  copilotName: string,
  trackName: string,
  careerWins: number
): { intro: DialogueLine[]; outro: DialogueLine[] } {
  const displayPilot = pilotNick ? `${pilotName} (${pilotNick})` : pilotName;
  const rankLine =
    careerWins === 0
      ? 'Essa é a nossa estreia oficial pelas rotas de The Jounnte e regiões vizinhas. Hora de mostrar quem domina o asfalto!'
      : `Já acumulamos ${careerWins} vitória${careerWins > 1 ? 's' : ''} na carreira — todas as patrulhas conhecem o nosso ronco!`;

  return {
    intro: [
      {
        speaker: copilotName,
        role: 'copilot',
        portrait: 'copilot',
        cameraShot: 'front_two_shot',
        text: `Telemetria online, ${displayPilot}! O GPS tático tá travado em ${trackName}. ${rankLine}`,
      },
      {
        speaker: displayPilot,
        role: 'pilot',
        portrait: 'pilot',
        cameraShot: 'pilot_closeup',
        text: 'Pressão do turbo no máximo e embreagem pronta. Qual é a leitura das primeiras curvas?',
      },
      {
        speaker: copilotName,
        role: 'copilot',
        portrait: 'copilot',
        cameraShot: 'copilot_closeup',
        text: 'Tráfego ativo e viaturas fechando os cruzamentos. Segura o drift na saída das avenidas e usa o nitro na reta limpa!',
      },
      {
        speaker: 'Central Policial',
        role: 'dispatch',
        portrait: 'dispatch',
        radioEffect: true,
        cameraShot: 'car_exterior_hero',
        text: `Atenção viaturas em ${trackName}: corredor clandestino identificado na linha de largada. Iniciar interceptação!`,
      },
    ],
    outro: [
      {
        speaker: copilotName,
        role: 'copilot',
        portrait: 'copilot',
        cameraShot: 'copilot_closeup',
        text: `SINAL POLICIAL PERDIDO! ${displayPilot}, você deixou todas as viaturas comendo poeira!`,
      },
      {
        speaker: displayPilot,
        role: 'pilot',
        portrait: 'pilot',
        cameraShot: 'front_two_shot',
        text: 'Mais uma vitória pra conta. Bora pra garagem preparar o próximo golpe.',
      },
    ],
  };
}

export function getCareerOpenWorldIntro(
  pilotName: string,
  pilotNick: string,
  copilotName: string,
  trackName: string
): DialogueLine[] {
  const displayPilot = pilotNick ? `${pilotName} (${pilotNick})` : pilotName;
  return [
    {
      speaker: copilotName,
      role: 'copilot',
      portrait: 'copilot',
      cameraShot: 'front_two_shot',
      text: `Mapa liberado em ${trackName}, ${displayPilot}! Sem traçado obrigatório hoje — explore cada bairro e estrada livremente.`,
    },
    {
      speaker: displayPilot,
      role: 'pilot',
      portrait: 'pilot',
      cameraShot: 'pilot_closeup',
      text: 'Perfeito! Se a polícia colar, usamos as oficinas Pay & Spray e recolhemos os pacotes da equipe!',
    },
  ];
}

export const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: 1,
    title: 'Capítulo 1: Fuga Noturna — O Muro e a Explosão',
    subtitle: 'Quebra das Celas, Furtividade e o Carro Sem Controle em The Jounnte',
    briefing:
      'Miguel e Luca parecem dois criminosos comuns à primeira vista, mas carregam algo diferente dos outros presos. Ao lado de Alan, André (Andreiwalt) e Ana, o objetivo é escapar da prisão à noite e retomar a vida no crime. Após quebrar o muro das celas e passar furtivamente pelos guardas até o muro final, quando estão prestes a serem apanhados, um carro esportivo aparentemente sem ninguém dentro surge desgovernado e explode contra a estrutura — libertando a dupla indiretamente e dando início à fuga por The Jounnte.',
    trackId: 'track_city',
    initialHeat: 3,
    objectiveText: 'Aproveite a brecha da explosão no muro final e escape das patrulhas noturnas de The Jounnte!',
    timeLimitSec: 120,
    rewardCash: 25000,
    rewardRep: 350,
    dialogueIntro: [
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Silêncio total, Luca. Quebramos o muro da ala das celas na hora exata da troca de turno. Os guardas ainda não viram o buraco.',
      },
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'copilot_closeup',
        text: 'Tô colado na sombra, Miguel. Alan, Ana e André (Andreiwalt) disseram que o ponto de extração fica logo depois do muro final.',
      },
      {
        speaker: 'Guarda da Torre',
        role: 'guard',
        portrait: 'guard',
        radioEffect: true,
        cameraShot: 'cop_radio_insert',
        text: 'ATENÇÃO PÁTIO NORTE! Movimento junto ao muro final! Acendam os holofotes, dois detentos estão encurralados no perímetro!',
      },
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'front_two_shot',
        text: 'Droga, os portões fecharam e as armas já estão apontadas pra cá! Não tem para onde correr — espera... QUE RONCO DE MOTOR É ESSE?!',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'car_exterior_hero',
        text: 'OLHA AQUELE ESPORTIVO SEM NINGUÉM NO VOLANTE VINDO SEM CONTROLE PRO MURO! ABAIXA, LUCA! VAI EXPLODIR!',
      },
      {
        speaker: 'Ana (Rádio)',
        role: 'ally',
        portrait: 'ana',
        radioEffect: true,
        cameraShot: 'side_window',
        text: 'A estrutura inteira veio abaixo na explosão! Aproveitem a fumaça! O segundo carro tá ligado na rua de trás — entrem e sumam por The Jounnte!',
      },
    ],
    dialogueMidList: [
      {
        triggerSec: 16,
        lines: [
          {
            speaker: 'Alan (Rádio)',
            role: 'ally',
            portrait: 'alan',
            radioEffect: true,
            text: 'Miguel, Luca, conseguimos despistar a guarda externa! Sigam pelo Bairro Industrial em direção a The Lained!',
          },
          {
            speaker: 'Miguel',
            role: 'pilot',
            portrait: 'miguel',
            text: 'Ninguém sabe quem soltou aquele carro desgovernado no muro... mas acabou de nos devolver a rua inteira!',
          },
        ],
      },
      {
        triggerSec: 40,
        lines: [
          {
            speaker: 'André / Andreiwalt',
            role: 'ally',
            portrait: 'andre',
            radioEffect: true,
            text: 'Várias viaturas saindo do Bairro Comercial pra fechar a saída da penitenciária. Usem o drift nas esquinas para quebrar a linha de visão!',
          },
        ],
      },
    ],
    dialogueOutro: [
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'copilot_closeup',
        text: 'Saímos da zona da prisão! Os giroflex sumiram lá atrás na névoa de The Jounnte.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'front_two_shot',
        text: 'A gente não é preso comum, Luca... e a partir de hoje a cidade vai lembrar por quê. Hora de reunir Alan, André e Ana.',
      },
    ],
  },
  {
    id: 2,
    title: 'Capítulo 2: Ruas de The Jounnte — The Lained e a Praia',
    subtitle: 'Reagrupando Alan, André/Andreiwalt e Ana nos Bairros da Cidade',
    briefing:
      'Livres da penitenciária, Miguel e Luca percorrem os cinco grandes setores de The Jounnte — Bairro Comercial, Bairro Residencial, Bairro Industrial, Praia e The Lained — para recuperar armas, dinheiro oculto e reunir toda a equipe antes da polícia fechar as pontes.',
    trackId: 'track_city',
    initialHeat: 3,
    objectiveText: 'Atravesse os bairros de The Jounnte, recolha a equipe e despiste o cerco até The Lained!',
    timeLimitSec: 140,
    rewardCash: 40000,
    rewardRep: 500,
    dialogueIntro: [
      {
        speaker: 'André / Andreiwalt',
        role: 'ally',
        portrait: 'andre',
        cameraShot: 'front_two_shot',
        text: 'Bem-vindos de volta ao jogo, irmãos. Separei rotas pelo Bairro Residencial até a Praia de The Jounnte antes de cortarmos para The Lained.',
      },
      {
        speaker: 'Alan',
        role: 'ally',
        portrait: 'alan',
        cameraShot: 'pilot_closeup',
        text: 'A polícia tá revistando o Bairro Comercial inteiro atrás de vocês dois. Se encostarem demais, eu e a Ana cobrimos os flancos.',
      },
      {
        speaker: 'Ana',
        role: 'ally',
        portrait: 'ana',
        cameraShot: 'copilot_closeup',
        text: 'Os cofres do submundo em The Lained estão sem dono desde que prenderam vocês. Hoje a gente recupera tudo com juros.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'side_window',
        text: 'Sem piedade. Luca no controle tático, o resto protege a retaguarda — vamos tomar The Jounnte rua por rua!',
      },
    ],
    dialogueMidList: [
      {
        triggerSec: 22,
        lines: [
          {
            speaker: 'Luca',
            role: 'copilot',
            portrait: 'luca',
            text: 'Bloqueio montado perto da Praia! Cuidado com os carros de patrulha cruzando a orla!',
          },
          {
            speaker: 'Ana',
            role: 'ally',
            portrait: 'ana',
            radioEffect: true,
            text: 'Abri passagem pela lateral do Bairro Industrial! Acelerem para The Lained!',
          },
        ],
      },
    ],
    dialogueOutro: [
      {
        speaker: 'Alan',
        role: 'ally',
        portrait: 'alan',
        cameraShot: 'front_two_shot',
        text: 'The Lained está sob nosso controle e os contatos voltaram a obedecer. Mas a força estadual fechou todas as saídas urbanas.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Então vamos furar a Fronteira Principal rumo às florestas de The Chamed!',
      },
    ],
  },
  {
    id: 3,
    title: 'Capítulo 3: Fronteira Principal — Floresta de The Chamed',
    subtitle: 'Árvores Cerradas, Avenida Principal e Bairros da Divisa',
    briefing:
      'Para escapar da caçada em The Jounnte, o bando avança pela Fronteira Principal entrando em The Chamed — uma vasta floresta com campo marcada por árvores altas, pela Avenida Principal, e pelos setores Residencial e Industrial da divisa.',
    trackId: 'track_suburb',
    initialHeat: 4,
    objectiveText: 'Cruze a Fronteira Principal, domine a Avenida Principal de The Chamed e vença os Interceptores!',
    timeLimitSec: 150,
    rewardCash: 60000,
    rewardRep: 800,
    dialogueIntro: [
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'copilot_closeup',
        text: 'Atravessamos a Fronteira Principal! Bem-vindos a The Chamed — só árvore cerrada, estrada aberta e a Avenida Principal lá na frente.',
      },
      {
        speaker: 'André / Andreiwalt',
        role: 'ally',
        portrait: 'andre',
        radioEffect: true,
        cameraShot: 'side_window',
        text: 'Cuidado entre o Bairro Residencial e o Bairro Industrial de The Chamed. A Polícia Florestal montou interceptadores de alta velocidade nas curvas.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Quanto mais rápido o cerco fica, mais claro fica o nosso poder. Segura firme, Luca!',
      },
    ],
    dialogueMidList: [
      {
        triggerSec: 25,
        lines: [
          {
            speaker: 'Alan',
            role: 'ally',
            portrait: 'alan',
            radioEffect: true,
            text: 'Tô segurando duas viaturas perto das árvores da Fronteira Principal! Continuem firme pela Avenida Principal!',
          },
          {
            speaker: 'Central Policial',
            role: 'dispatch',
            portrait: 'dispatch',
            radioEffect: true,
            text: 'Atenção: os fugitivos de The Jounnte romperam a barreira da Avenida Principal de The Chamed!',
          },
        ],
      },
    ],
    dialogueOutro: [
      {
        speaker: 'Ana',
        role: 'ally',
        portrait: 'ana',
        cameraShot: 'copilot_closeup',
        text: 'Saímos da mata de The Chamed intactos. À frente, o asfalto vira poeira: é o território seco de The Laymed.',
      },
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'front_two_shot',
        text: 'Bairros Pequenos, Vales de Areia e a Zona de Perigo nos esperam lá embaixo.',
      },
    ],
  },
  {
    id: 4,
    title: 'Capítulo 4: Zona de Perigo — O Deserto de The Laymed',
    subtitle: 'Bairros Pequenos, Estabelecimentos Isolados e Vales de Areia',
    briefing:
      'Nas terras áridas de The Laymed, pequenos estabelecimentos e bairros pequenos escondem depósitos estratégicos do submundo, cercados pelos Vales de Areia e pela letal Zona de Perigo onde forças táticas armam uma emboscada.',
    trackId: 'track_desert',
    initialHeat: 4,
    objectiveText: 'Atravesse os Vales de Areia e sobreviva à emboscada policial na Zona de Perigo de The Laymed!',
    timeLimitSec: 170,
    rewardCash: 90000,
    rewardRep: 1200,
    dialogueIntro: [
      {
        speaker: 'André / Andreiwalt',
        role: 'ally',
        portrait: 'andre',
        cameraShot: 'front_two_shot',
        text: 'Isso aqui é The Laymed. Passamos pelos Bairros Pequenos e pelos estabelecimentos da estrada, mas agora estamos entrando nos Vales de Areia.',
      },
      {
        speaker: 'Ana',
        role: 'ally',
        portrait: 'ana',
        radioEffect: true,
        cameraShot: 'copilot_closeup',
        text: 'Alerta vermelho: o satélite captou blindados cercando a Zona de Perigo. Se perdermos tração na areia, o cerco fecha.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Então a gente não tira o pé do acelerador. Tudo que construímos até aqui nos leva direto pra The San Bernard!',
      },
    ],
    dialogueMidList: [
      {
        triggerSec: 30,
        lines: [
          {
            speaker: 'Luca',
            role: 'copilot',
            portrait: 'luca',
            text: 'Entrando na Zona de Perigo! Blindado à direita nos Vales de Areia — usa o nitro para passar por fora!',
          },
          {
            speaker: 'Alan',
            role: 'ally',
            portrait: 'alan',
            radioEffect: true,
            text: 'Eu e o André estamos garantindo a saída norte rumo a The San Bernard. Não olhem para trás!',
          },
        ],
      },
    ],
    dialogueOutro: [
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Deixamos o deserto de The Laymed queimando no retrovisor. Agora resta o maior alvo de todos.',
      },
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'front_two_shot',
        text: 'The San Bernard. Quem controla aquela cidade-vila controla mais poder do que o próprio governo.',
      },
    ],
  },
  {
    id: 5,
    title: 'Capítulo 5: The San Bernard — O Trono Acima do Governo',
    subtitle: 'O Cerco Final e a Decisão que Define o Destino do Bando',
    briefing:
      'Na grande cidade/vila de The San Bernard, Miguel, Luca, Alan, André/Andreiwalt e Ana enfrentam toda a força do Estado. Sua fuga e suas escolhas no clímax definirão qual dos quatro desfechos marcará a história do bando para sempre.',
    trackId: 'track_san_bernard',
    initialHeat: 5,
    objectiveText: 'Sobreviva ao cerco máximo em The San Bernard para decidir o desfecho final de Miguel, Luca e sua equipe!',
    timeLimitSec: 190,
    rewardCash: 160000,
    rewardRep: 2500,
    dialogueIntro: [
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Olha o tamanho de The San Bernard... Toda a rede de poder do país passa por essas ruas. Hoje a gente para de fugir e passa a mandar.',
      },
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'copilot_closeup',
        text: 'Desde aquela noite quebrando o muro da cela até aqui... cada segundo levou a esse momento. Mas algo no olhar do Miguel tá diferente hoje.',
      },
      {
        speaker: 'Alan',
        role: 'ally',
        portrait: 'alan',
        radioEffect: true,
        cameraShot: 'side_window',
        text: 'O governo deslocou todas as unidades táticas pra The San Bernard! Ana e André já estão em posição — quando rompermos o bloqueio, não tem volta!',
      },
      {
        speaker: 'Ana',
        role: 'ally',
        portrait: 'ana',
        radioEffect: true,
        cameraShot: 'front_two_shot',
        text: 'Fiquem juntos! Seja qual for a decisão lá no prédio central, todos nós entramos nisso juntos!',
      },
    ],
    dialogueMidList: [
      {
        triggerSec: 32,
        lines: [
          {
            speaker: 'André / Andreiwalt',
            role: 'ally',
            portrait: 'andre',
            radioEffect: true,
            text: 'Os blindados fecharam a praça de The San Bernard! Quebrem o perímetro com tudo!',
          },
          {
            speaker: 'Miguel',
            role: 'pilot',
            portrait: 'miguel',
            text: 'Nenhuma lei, nenhuma prisão e nenhum governo vai ficar no nosso caminho!',
          },
        ],
      },
    ],
    dialogueOutro: [
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'front_two_shot',
        text: 'Rompemos a última barreira de The San Bernard! A cúpula do governo está a metros daqui... qual é o nosso último movimento, Miguel?',
      },
    ],
  },
];

export const STORY_ENDINGS: Record<StoryEndingId, StoryEndingInfo> = {
  true: {
    id: 'true',
    badge: 'FINAL VERDADEIRO · 1/4',
    title: 'ACIMA DO PRÓPRIO GOVERNO',
    subtitle: 'Império Absoluto de Miguel & Luca',
    summary:
      'Miguel e Luca executam a tomada tática perfeita com Alan, Ana e André/Andreiwalt protegidos. A dupla conquista The Jounnte, The Chamed, The Laymed e The San Bernard inteiras — tornando-se mais poderosa do que o próprio governo.',
    choiceLabel: '👑 Pacto Leal: Tomar o Poder Juntos (Final Verdadeiro)',
    choiceDescription:
      'Coordena a equipe inteira sem sacrifícios: todos sobrevivem, a cidade inteira cai sob o domínio de Miguel e Luca e o governo se curva diante deles.',
    toneClass: 'ending-true',
    rewardCash: 300000,
    rewardRep: 5000,
    epilogueLines: [
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'front_two_shot',
        text: 'Os ministros recuaram, as forças de segurança baixaram as armas e The Jounnte até The San Bernard agora respondem a nós.',
      },
      {
        speaker: 'Alan',
        role: 'ally',
        portrait: 'alan',
        cameraShot: 'side_window',
        text: 'Ninguém ficou para trás! Eu, Ana e André seguramos todas as pontas — a cidade inteira é oficialmente nossa!',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'car_exterior_hero',
        text: 'Saímos da cela quebrando um muro no escuro... e hoje somos mais poderosos do que o próprio governo.',
      },
    ],
  },
  good: {
    id: 'good',
    badge: 'FINAL BOM · 2/4',
    title: 'O PREÇO DA COROA',
    subtitle: 'Poder Supremo, Mas Perdas no Bando',
    summary:
      'Miguel e Luca atingem o topo do poder e assumem o controle absoluto, mas a vitória tem um custo sangrento: Alan morre enfrentando a polícia na linha de frente e Ana é baleada durante a invasão.',
    choiceLabel: '⚔️ Assalto Frontal Sem Recuo (Final Bom)',
    choiceDescription:
      'Força a entrada direta no comando estadual: Miguel e Luca atingem o topo do poder, porém Alan cai diante da polícia e Ana acaba baleada.',
    toneClass: 'ending-good',
    rewardCash: 220000,
    rewardRep: 3200,
    epilogueLines: [
      {
        speaker: 'André / Andreiwalt',
        role: 'ally',
        portrait: 'andre',
        cameraShot: 'side_window',
        text: 'Conseguimos o controle total, mas... o Alan não resistiu ao tiroteio com a polícia. E a Ana foi baleada segurando a porta pra vocês passarem!',
      },
      {
        speaker: 'Ana (Ferida)',
        role: 'ally',
        portrait: 'ana',
        cameraShot: 'copilot_closeup',
        text: 'Eu... eu vou sobreviver, Luca. O Alan deu a vida pra vocês chegarem ao topo. Não deixem que seja em vão.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Chegamos ao topo do poder... mas nunca vamos esquecer o sangue derramado nessa cidade.',
      },
    ],
  },
  bad: {
    id: 'bad',
    badge: 'FINAL RUIM · 3/4',
    title: 'CINZAS NA SOMBRA',
    subtitle: 'O Fim Trágico de Miguel e o Sumiço de Luca',
    summary:
      'A emboscada no complexo fecha as saídas com gás tóxico e fogo: Miguel morre sufocado, Luca desaparece na escuridão sem deixar rasto, e Alan, Ana e André continuam vivos — carregando o peso das perdas dos amigos.',
    choiceLabel: '💨 Emboscada Sufocante / Derrota no Cerco (Final Ruim)',
    choiceDescription:
      'O cerco vence ou o recuo pelos dutos falha: Miguel morre sufocado, Luca desaparece, e Alan, Ana e André sobrevivem abalados.',
    toneClass: 'ending-bad',
    rewardCash: 45000,
    rewardRep: 600,
    epilogueLines: [
      {
        speaker: 'Ana',
        role: 'ally',
        portrait: 'ana',
        cameraShot: 'copilot_closeup',
        text: 'A câmara encheu de fumaça e gás... quando abrimos a comporta, já era tarde. O Miguel morreu sufocado lá dentro.',
      },
      {
        speaker: 'André / Andreiwalt',
        role: 'ally',
        portrait: 'andre',
        cameraShot: 'side_window',
        text: 'E o Luca simplesmente desapareceu no meio do cerco. Procuramos por toda The Jounnte, The Chamed e The Laymed... nada.',
      },
      {
        speaker: 'Alan',
        role: 'ally',
        portrait: 'alan',
        cameraShot: 'car_exterior_hero',
        text: 'Nós três continuamos vivos, mas tudo desmoronou. Nada do que sobrou paga a perda dos nossos amigos.',
      },
    ],
  },
  false: {
    id: 'false',
    badge: 'FINAL FALSO · 4/4',
    title: 'A LÂMINA NA CÚPULA',
    subtitle: 'Traição de Miguel Contra Luca',
    summary:
      'No instante em que a vitória se concretiza, Miguel revela seu lado mais frio: conquista tudo sozinho, trai seu próprio parceiro de fuga e mata Luca à facada para não dividir o trono.',
    choiceLabel: '🗡️ Conquistar Tudo Sozinho e Trair Luca (Final Falso)',
    choiceDescription:
      'Miguel toma o controle absoluto para si, apunhala Luca pelas costas e assume o império sozinho.',
    toneClass: 'ending-false',
    rewardCash: 180000,
    rewardRep: 1800,
    epilogueLines: [
      {
        speaker: 'Luca',
        role: 'copilot',
        portrait: 'luca',
        cameraShot: 'copilot_closeup',
        text: 'Miguel?! Por que você trancou a sala... o que é essa faca na sua mão?! Depois de tudo que passamos desde a prisão?!',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'pilot_closeup',
        text: 'Você nunca percebeu por que eu era diferente dos outros presos, Luca. Um império desse tamanho só cabe em um nome... e é o meu.',
      },
      {
        speaker: 'Miguel',
        role: 'pilot',
        portrait: 'miguel',
        cameraShot: 'car_exterior_hero',
        text: 'Adeus, parceiro. Agora a cidade inteira, o crime e o trono pertencem apenas a mim.',
      },
    ],
  },
};
