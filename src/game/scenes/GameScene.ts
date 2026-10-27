import * as Phaser from 'phaser';
import { QIAN_CHIBI_STAGES } from '../data/qianchibi';
import { LearningEvidence } from '../learningEvidence';

type Screen = 'menu' | 'explore' | 'compose' | 'challenge' | 'map' | 'reflection' | 'result';
type QuizPart = 'emotion' | 'evidence';

const STAMPS = [
  { id: 'moon', label: '明月' },
  { id: 'wind', label: '清風' },
  { id: 'water', label: '江水' },
  { id: 'mist', label: '白露' },
  { id: 'boat', label: '小舟' },
  { id: 'mountain', label: '山影' },
];

export class GameScene extends Phaser.Scene {
  private screen: Screen = 'menu';
  private mode: '個人' | '雙人合作' = '個人';
  private session: '短局' | '標準局' = '短局';
  private stageIndex = 0;
  private revealedClues = QIAN_CHIBI_STAGES.map(() => new Set<number>());
  private lastClue = '';
  private placedPositions: Record<string, { x: number; y: number }> = {};
  private boardBox = { x: 0, y: 0, width: 0, height: 0 };
  private composeStatus?: Phaser.GameObjects.Text;
  private quizPart: QuizPart = 'emotion';
  private attempts = 0;
  private feedback = '';
  private emotionCorrect = false;
  private stageSolved = false;
  private selectedEmotions: string[] = [];
  private selectedEvidence: string[] = [];
  private finalOrder = [1, 2, 0];
  private orderFeedback = '';
  private reflectionDraft = '';
  private reflectionText = '';
  private orderAttempts = 0;
  private evidence = new LearningEvidence();

  constructor() {
    super('GameScene');
  }

  preload(): void {
    this.load.svg('ink-river', `${import.meta.env.BASE_URL}assets/game/ink-river-night.svg`, { width: 1280, height: 720 });
    for (const stamp of STAMPS) {
      this.load.svg(`stamp-${stamp.id}`, `${import.meta.env.BASE_URL}assets/game/stamp-${stamp.id}.svg`, { width: 120, height: 120 });
    }
  }

  create(): void {
    this.scale.on('resize', this.render, this);
    this.events.once('shutdown', this.removeReflectionOverlay, this);

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject, dragX: number, dragY: number) => {
      if (this.screen !== 'compose' || gameObject.getData('kind') !== 'stamp') return;
      (gameObject as Phaser.GameObjects.Image).setPosition(dragX, dragY);
    });

    this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (this.screen !== 'compose' || gameObject.getData('kind') !== 'stamp') return;
      const stamp = gameObject as Phaser.GameObjects.Image;
      const id = String(stamp.getData('stampId'));
      const inside = pointer.x >= this.boardBox.x && pointer.x <= this.boardBox.x + this.boardBox.width
        && pointer.y >= this.boardBox.y && pointer.y <= this.boardBox.y + this.boardBox.height;

      if (inside) {
        const isNewStamp = !this.placedPositions[id];
        this.placedPositions[id] = { x: stamp.x / this.scale.width, y: stamp.y / this.scale.height };
        if (isNewStamp) {
          const definition = STAMPS.find((item) => item.id === id);
          this.evidence.record({
            action: 'stamp_added',
            stageId: this.currentStage.id,
            choiceId: id,
            responseText: definition?.label ?? id,
          });
        }
      } else {
        delete this.placedPositions[id];
        stamp.setPosition(Number(stamp.getData('homeX')), Number(stamp.getData('homeY')));
      }

      const required = this.session === '標準局' ? 4 : 2;
      this.composeStatus?.setText(`已放入 ${Object.keys(this.placedPositions).length} 個圖章。${this.session}需放入 ${required} 個。`);
    });

    this.render();
  }

  private get currentStage() {
    return QIAN_CHIBI_STAGES[this.stageIndex];
  }

  private render(): void {
    const textarea = document.querySelector<HTMLTextAreaElement>('#reflection-overlay textarea');
    if (textarea) this.reflectionDraft = textarea.value;
    this.removeReflectionOverlay();
    this.children.removeAll(true);
    this.composeStatus = undefined;

    const width = this.scale.width;
    const height = this.scale.height;
    if (!width || !height || !this.textures.exists('ink-river')) return;

    this.add.image(width / 2, height / 2, 'ink-river').setDisplaySize(width, height).setDepth(-10);
    this.add.rectangle(width / 2, height / 2, width, height, 0xf6f1e2, 0.12).setDepth(-9);

    switch (this.screen) {
      case 'menu': this.drawMenu(); break;
      case 'explore': this.drawExplore(); break;
      case 'compose': this.drawCompose(); break;
      case 'challenge': this.drawChallenge(); break;
      case 'map': this.drawMap(); break;
      case 'reflection':
        this.drawReflection();
        this.createReflectionOverlay();
        break;
      case 'result': this.drawResult(); break;
    }
  }

  private drawMenu(): void {
    const { width: w, height: h } = this.scale;
    this.panel(w / 2, h * 0.2, w * 0.84, h * 0.24);
    this.text('月下赤壁', w / 2, h * 0.13, 42, '#273a33', w * 0.84, 'center');
    this.text('意象尋蹤', w / 2, h * 0.22, 24, '#536b5e', w * 0.84, 'center');
    this.text('乘上蘇軾的小舟，收集景物與詩句，拼出情緒變化。', w / 2, h * 0.31, 16, '#43534b', w * 0.84, 'center');

    this.text('遊玩方式', w / 2, h * 0.48, 16, '#293a33', w * 0.8, 'center');
    this.button(w * 0.36, h * 0.56, w * 0.3, 48, '個人遊玩', () => { this.mode = '個人'; this.render(); }, false, this.mode === '個人');
    this.button(w * 0.68, h * 0.56, w * 0.3, 48, '雙人合作', () => { this.mode = '雙人合作'; this.render(); }, false, this.mode === '雙人合作');

    this.text('遊玩時長', w / 2, h * 0.68, 16, '#293a33', w * 0.8, 'center');
    this.button(w * 0.36, h * 0.76, w * 0.3, 48, '短局 10–15 分鐘', () => { this.session = '短局'; this.render(); }, false, this.session === '短局');
    this.button(w * 0.68, h * 0.76, w * 0.3, 48, '標準局 20–25 分鐘', () => { this.session = '標準局'; this.render(); }, false, this.session === '標準局');

    this.button(w / 2, h * 0.92, Math.min(w * 0.54, 360), 52, '登舟開始探索', () => this.startGame(), true);
    this.text('水墨山水與古籍風格  ・  《赤壁賦》', w / 2, h * 0.985, 13, '#5e6c63', w * 0.9, 'center');
  }

  private startGame(): void {
    this.stageIndex = 0;
    this.revealedClues = QIAN_CHIBI_STAGES.map(() => new Set<number>());
    this.selectedEmotions = [];
    this.selectedEvidence = [];
    this.placedPositions = {};
    this.lastClue = '';
    this.finalOrder = [1, 2, 0];
    this.orderFeedback = '';
    this.orderAttempts = 0;
    this.reflectionText = '';
    this.screen = 'explore';
    this.evidence.start({ mode: this.mode, sessionLength: this.session });
    this.render();
  }

  private drawExplore(): void {
    const { width: w, height: h } = this.scale;
    const stage = this.currentStage;
    this.text(`赤壁夜遊　${this.stageIndex + 1} / ${QIAN_CHIBI_STAGES.length}　${this.mode}・${this.session}`, w * 0.06, h * 0.045, 16, '#293a33', w * 0.88);
    this.text(stage.title, w / 2, h * 0.115, 24, '#263a32', w * 0.88, 'center');

    this.panel(w / 2, h * 0.29, w * 0.9, h * 0.25);
    this.text(stage.excerpt, w * 0.08, h * 0.205, 17, '#283730', w * 0.84);

    const y = h * 0.57;
    stage.clues.forEach((clue, index) => {
      const x = w * (0.2 + index * 0.3);
      const found = this.revealedClues[this.stageIndex].has(index);
      const marker = this.add.circle(x, y, Math.max(22, Math.min(30, w * 0.03)), found ? 0x526d60 : 0xebe2cb, 0.96)
        .setStrokeStyle(3, 0x40574b, 1)
        .setInteractive({ useHandCursor: true });
      marker.on('pointerdown', () => {
        if (!this.revealedClues[this.stageIndex].has(index)) {
          this.evidence.record({
            action: 'clue_opened',
            stageId: stage.id,
            clueId: `${stage.id}-${index + 1}`,
            responseText: clue.quote,
          });
        }
        this.revealedClues[this.stageIndex].add(index);
        this.lastClue = clue.quote;
        this.render();
      });
      this.text(found ? '✓' : '尋', x, y, 18, found ? '#ffffff' : '#40574b', 52, 'center');
      this.text(clue.label, x, y + 36, 14, '#34453d', w * 0.27, 'center');
    });

    const cardTop = h * 0.7;
    this.panel(w / 2, h * 0.815, w * 0.9, h * 0.25);
    const count = this.revealedClues[this.stageIndex].size;
    this.text(`已找到 ${count} / ${stage.clues.length} 個線索`, w * 0.08, cardTop, 15, '#52675c', w * 0.84);
    this.text(this.lastClue || '點選上方景物線索，讀一讀它對應的詩句。', w * 0.08, cardTop + 30, 15, '#263830', w * 0.84);

    if (count === stage.clues.length) {
      this.button(w / 2, h * 0.95, Math.min(w * 0.64, 430), 48, '線索集齊，開始組合意象', () => {
        this.placedPositions = {};
        this.screen = 'compose';
        this.render();
      }, true);
    } else {
      this.text('找齊三個線索後，前往組圖。', w / 2, h * 0.95, 14, '#52675c', w * 0.88, 'center');
    }
  }

  private drawCompose(): void {
    const { width: w, height: h } = this.scale;
    const compact = w < 760;
    this.text(`意象組圖　${this.currentStage.title}　${this.mode}`, w / 2, h * 0.075, 24, '#263a32', w * 0.9, 'center');
    this.text(`提示詞：${this.currentStage.promptWords.join(' ・ ')}`, w / 2, h * 0.145, 15, '#40584c', w * 0.9, 'center');

    const board = compact
      ? { x: w * 0.05, y: h * 0.33, width: w * 0.9, height: h * 0.3 }
      : { x: w * 0.04, y: h * 0.26, width: w * 0.54, height: h * 0.55 };
    this.boardBox = board;
    this.add.rectangle(board.x + board.width / 2, board.y + board.height / 2, board.width, board.height, 0xf5f1e5, 0.88)
      .setStrokeStyle(3, 0x61766a, 0.95);
    this.text('把景物放進畫框，畫出你讀到的意象', board.x + board.width / 2, board.y + 16, 15, '#3d5145', board.width - 24, 'center');
    this.text(this.currentStage.promptWords.slice(0, 4).join('　'), board.x + board.width / 2, board.y + board.height - 26, 14, '#7c887c', board.width - 24, 'center');

    const size = compact ? 44 : 58;
    const positions = compact
      ? STAMPS.map((_stamp, i) => ({ x: w * (0.17 + (i % 3) * 0.33), y: h * (0.7 + Math.floor(i / 3) * 0.105) }))
      : STAMPS.map((_stamp, i) => ({ x: w * (0.68 + (i % 2) * 0.17), y: h * (0.32 + Math.floor(i / 2) * 0.19) }));

    STAMPS.forEach((definition, index) => {
      const home = positions[index];
      const placed = this.placedPositions[definition.id];
      const stamp = this.add.image(placed ? placed.x * w : home.x, placed ? placed.y * h : home.y, `stamp-${definition.id}`)
        .setDisplaySize(size, size)
        .setInteractive({ useHandCursor: true });
      stamp.setData('kind', 'stamp');
      stamp.setData('stampId', definition.id);
      stamp.setData('homeX', home.x);
      stamp.setData('homeY', home.y);
      this.input.setDraggable(stamp);
      this.text(definition.label, home.x, home.y + size * 0.58, 14, '#33453d', 80, 'center');
    });

    const placedCount = Object.keys(this.placedPositions).length;
    const requiredStamps = this.session === '標準局' ? 4 : 2;
    this.composeStatus = this.text(`已放入 ${placedCount} 個圖章。${this.session}需放入 ${requiredStamps} 個。`, w / 2, h * 0.88, 14, '#52675c', w * 0.9, 'center');
    this.button(w / 2, h * 0.96, Math.min(w * 0.62, 400), 48, '完成意象畫面，開始解讀', () => {
      if (Object.keys(this.placedPositions).length < requiredStamps) {
        this.composeStatus?.setText(`先把至少 ${requiredStamps} 個景物圖章拖進畫框，再繼續。`);
        return;
      }
      this.quizPart = 'emotion';
      this.attempts = 0;
      this.feedback = '';
      this.emotionCorrect = false;
      this.stageSolved = false;
      this.screen = 'challenge';
      this.render();
    }, true);
  }

  private drawChallenge(): void {
    const { width: w, height: h } = this.scale;
    const stage = this.currentStage;
    this.text(`解讀線索　${this.stageIndex + 1} / ${QIAN_CHIBI_STAGES.length}`, w * 0.06, h * 0.045, 15, '#52675c', w * 0.88);
    this.text(stage.title, w / 2, h * 0.105, 23, '#263a32', w * 0.88, 'center');

    this.panel(w / 2, h * 0.255, w * 0.9, h * 0.25);
    this.text(stage.excerpt, w * 0.08, h * 0.17, 16, '#283730', w * 0.84);

    if (this.stageSolved) {
      this.text('線索卡已收集', w / 2, h * 0.47, 17, '#405e4c', w * 0.9, 'center');
      this.text(this.feedback, w * 0.08, h * 0.53, 15, '#293a33', w * 0.84);
      this.button(w / 2, h * 0.9, Math.min(w * 0.64, 430), 50, this.stageIndex < 2 ? '收下線索卡，前往下一段' : '收下線索卡，整理情緒變化', () => this.completeStage(), true);
      return;
    }

    const question = this.quizPart === 'emotion' ? stage.emotionQuestion : stage.evidenceQuestion;
    const options = this.quizPart === 'emotion' ? stage.emotionOptions : stage.evidenceOptions;
    this.text(question, w * 0.06, h * 0.405, 16, '#293a33', w * 0.88);
    if (this.feedback) this.text(this.feedback, w * 0.06, h * 0.48, 14, '#52675c', w * 0.88);

    const compactHeight = h < 500;
    const buttonHeight = compactHeight ? 46 : Math.max(54, Math.min(72, h * 0.09));
    const step = buttonHeight + (compactHeight ? 7 : 10);
    const top = h * (compactHeight ? 0.55 : 0.59);
    options.forEach((option, index) => {
      this.button(w / 2, top + index * step, w * 0.88, buttonHeight, option.text, () => this.chooseAnswer(index), false);
    });
  }

  private chooseAnswer(index: number): void {
    const stage = this.currentStage;
    const options = this.quizPart === 'emotion' ? stage.emotionOptions : stage.evidenceOptions;
    const option = options[index];
    const attemptNo = this.attempts + 1;
    this.evidence.record({
      action: this.quizPart === 'emotion' ? 'emotion_answer' : 'evidence_answer',
      stageId: stage.id,
      choiceId: `option-${index + 1}`,
      isCorrect: option.correct,
      attemptNo,
      hintLevel: option.correct ? 'none' : attemptNo === 1 ? 'hint' : 'hint-and-explanation',
      responseText: option.text,
    });

    if (!option.correct) {
      this.attempts += 1;
      this.feedback = this.quizPart === 'emotion'
        ? (this.attempts === 1 ? stage.emotionHint : `${stage.emotionHint}\n${stage.emotionExplanation}`)
        : (this.attempts === 1 ? stage.evidenceHint : `${stage.evidenceHint}\n${stage.evidenceExplanation}`);
      this.render();
      return;
    }

    if (this.quizPart === 'emotion') {
      this.emotionCorrect = true;
      this.selectedEmotions[this.stageIndex] = stage.emotion;
      this.quizPart = 'evidence';
      this.attempts = 0;
      this.feedback = '情緒解讀有線索支持。接著選出最能作證的原文。';
    } else {
      this.stageSolved = true;
      this.selectedEvidence[this.stageIndex] = option.text;
      this.feedback = stage.evidenceExplanation;
    }
    this.render();
  }

  private completeStage(): void {
    if (this.stageIndex < QIAN_CHIBI_STAGES.length - 1) {
      this.stageIndex += 1;
      this.lastClue = '';
      this.placedPositions = {};
      this.stageSolved = false;
      this.emotionCorrect = false;
      this.quizPart = 'emotion';
      this.attempts = 0;
      this.feedback = '';
      this.screen = 'explore';
    } else {
      this.finalOrder = [1, 2, 0];
      this.orderFeedback = '';
      this.screen = 'map';
    }
    this.render();
  }

  private drawMap(): void {
    const { width: w, height: h } = this.scale;
    this.text('把情緒變化排成一段旅程', w / 2, h * 0.1, 25, '#263a32', w * 0.9, 'center');
    this.text('用 ↑ 和 ↓ 調整順序，再確認你的解讀。', w / 2, h * 0.18, 15, '#52675c', w * 0.9, 'center');

    const rowHeight = Math.min(82, h * 0.13);
    const firstY = h * 0.32;
    this.finalOrder.forEach((stageIndex, position) => {
      const stage = QIAN_CHIBI_STAGES[stageIndex];
      const y = firstY + position * (rowHeight + 12);
      this.panel(w * 0.46, y, w * 0.76, rowHeight, 0xf7f4e9, 0.96);
      this.text(`${position + 1}. ${stage.emotion}`, w * 0.12, y - 12, 16, '#405a4b', w * 0.62);
      this.text(stage.summary, w * 0.12, y + 12, 14, '#35443c', w * 0.62);
      this.button(w * 0.88, y - 13, 42, 38, '↑', () => this.moveCard(position, -1), false);
      this.button(w * 0.88, y + 25, 42, 38, '↓', () => this.moveCard(position, 1), false);
    });

    if (this.orderFeedback) this.text(this.orderFeedback, w / 2, h * 0.83, 14, '#785f3f', w * 0.9, 'center');
    this.button(w / 2, h * 0.93, Math.min(w * 0.64, 420), 50, '確認情緒變化，寫下你的解讀', () => this.confirmOrder(), true);
  }

  private moveCard(position: number, direction: number): void {
    const next = position + direction;
    if (next < 0 || next >= this.finalOrder.length) return;
    [this.finalOrder[position], this.finalOrder[next]] = [this.finalOrder[next], this.finalOrder[position]];
    this.orderFeedback = '';
    this.render();
  }

  private confirmOrder(): void {
    const isCorrect = this.finalOrder.join(',') === '0,1,2';
    this.orderAttempts += 1;
    this.evidence.record({
      action: 'emotion_order_submitted',
      choiceId: `order-attempt-${this.orderAttempts}`,
      isCorrect,
      attemptNo: this.orderAttempts,
      responseText: this.finalOrder.map((stageIndex) => QIAN_CHIBI_STAGES[stageIndex].emotion).join(' → '),
    });

    if (!isCorrect) {
      this.orderFeedback = '提示：先是夜遊之樂，再聽見客的悲慨，最後讀到蘇子談水月與客喜而笑。';
      this.render();
      return;
    }
    this.screen = 'reflection';
    this.render();
  }

  private drawReflection(): void {
    const { width: w, height: h } = this.scale;
    this.text('完成你的賞析', w / 2, h * 0.13, 28, '#263a32', w * 0.9, 'center');
    this.panel(w / 2, h * 0.42, w * 0.84, h * 0.35);
    this.text('情緒路徑', w / 2, h * 0.29, 17, '#405a4b', w * 0.8, 'center');
    this.text(QIAN_CHIBI_STAGES.map((stage) => stage.emotion).join('　→　'), w / 2, h * 0.37, 20, '#263a32', w * 0.78, 'center');
    this.text('用一兩句話說明情緒如何變化，並引用一處原文作證。', w / 2, h * 0.53, 16, '#35443c', w * 0.78, 'center');
  }

  private createReflectionOverlay(): void {
    const root = document.getElementById('game');
    if (!root) return;

    const overlay = document.createElement('div');
    overlay.id = 'reflection-overlay';
    overlay.className = 'reflection-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'reflection-title');

    const card = document.createElement('section');
    card.className = 'reflection-card';
    const title = document.createElement('h2');
    title.id = 'reflection-title';
    title.textContent = '寫下你的解讀';
    const help = document.createElement('p');
    help.textContent = '用一兩句話說明情緒變化，引用原文中的景物或詩句作為證據。';
    const textarea = document.createElement('textarea');
    textarea.setAttribute('aria-label', '你的賞析與原文證據');
    textarea.placeholder = '我從「＿＿＿」讀到＿＿＿，因為……';
    textarea.value = this.reflectionDraft;
    textarea.addEventListener('input', () => { this.reflectionDraft = textarea.value; });

    const actions = document.createElement('div');
    actions.className = 'reflection-actions';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.textContent = '完成並展示';
    submit.addEventListener('click', () => { void this.finishReflection(textarea.value); });
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'quiet';
    skip.textContent = '稍後補寫';
    skip.addEventListener('click', () => { void this.finishReflection(''); });

    actions.append(submit, skip);
    card.append(title, help, textarea, actions);
    overlay.append(card);
    root.append(overlay);
  }

  private async finishReflection(value: string): Promise<void> {
    this.reflectionText = value.trim();
    this.reflectionDraft = this.reflectionText;
    this.screen = 'result';
    this.render();
    await this.evidence.complete(this.reflectionText);
  }

  private removeReflectionOverlay(): void {
    document.getElementById('reflection-overlay')?.remove();
  }

  private drawResult(): void {
    const { width: w, height: h } = this.scale;
    this.text('赤壁夜遊賞析成果', w / 2, h * 0.09, 26, '#263a32', w * 0.9, 'center');
    this.text(`情緒路徑：${QIAN_CHIBI_STAGES.map((stage) => stage.emotion).join(' → ')}`, w / 2, h * 0.18, 17, '#405a4b', w * 0.9, 'center');

    QIAN_CHIBI_STAGES.forEach((stage, index) => {
      const y = h * (0.31 + index * 0.14);
      this.panel(w / 2, y, w * 0.88, h * 0.12, 0xf7f4e9, 0.94);
      this.text(`${index + 1}. ${stage.emotion}　${stage.summary}`, w * 0.09, y - 18, 14, '#293a33', w * 0.82);
      const evidence = this.selectedEvidence[index] || '';
      this.text(`原文證據：${this.truncate(evidence, 52)}`, w * 0.09, y + 5, 13, '#53665b', w * 0.82);
    });

    const responseY = h * 0.76;
    this.panel(w / 2, responseY, w * 0.88, h * 0.15, 0xf7f4e9, 0.94);
    this.text('我的解讀', w * 0.09, responseY - h * 0.052, 14, '#405a4b', w * 0.82);
    this.text(this.reflectionText || '（尚未填寫，可重新遊玩後補寫。）', w * 0.09, responseY - h * 0.025, 14, '#293a33', w * 0.82);

    this.button(w * 0.34, h * 0.94, w * 0.38, 48, '下載成果圖', () => this.downloadResult(), true);
    this.button(w * 0.75, h * 0.94, w * 0.3, 48, '再玩一次', () => this.startGame(), false);
  }

  private downloadResult(): void {
    const anchor = document.createElement('a');
    anchor.href = this.game.canvas.toDataURL('image/png');
    anchor.download = '赤壁賦賞析成果.png';
    anchor.click();
  }

  private truncate(value: string, limit: number): string {
    if (value.length <= limit) return value;
    return `${value.slice(0, limit - 1)}…`;
  }

  private panel(x: number, y: number, width: number, height: number, fill = 0xf7f4e9, alpha = 0.92): Phaser.GameObjects.Rectangle {
    return this.add.rectangle(x, y, width, height, fill, alpha).setStrokeStyle(2, 0x7a897d, 0.84);
  }

  private button(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void,
    primary = false,
    selected = false,
  ): void {
    const fill = primary ? 0x40584c : selected ? 0xdce4d8 : 0xf8f5ea;
    const foreground = primary ? '#ffffff' : '#2d4037';
    const background = this.add.rectangle(x, y, width, height, fill, 0.98)
      .setStrokeStyle(2, primary ? 0x34483d : 0x738176, 0.95)
      .setInteractive({ useHandCursor: true });
    background.on('pointerover', () => background.setFillStyle(primary ? 0x526c5e : 0xe8ebdf, 1));
    background.on('pointerout', () => background.setFillStyle(fill, 0.98));
    background.on('pointerdown', onClick);
    this.text(label, x, y, 15, foreground, width - 18, 'center');
  }

  private text(
    value: string,
    x: number,
    y: number,
    size: number,
    color = '#293a33',
    wrapWidth?: number,
    align: 'left' | 'center' | 'right' = 'left',
  ): Phaser.GameObjects.Text {
    const viewportRatio = Math.min(this.scale.width / 1000, this.scale.height / 650);
    const fontSize = Math.max(14, Math.round(size * Math.min(1.12, Math.max(0.76, viewportRatio))));
    return this.add.text(x, y, value, {
      fontFamily: '"Microsoft JhengHei", "Noto Sans CJK TC", sans-serif',
      fontSize: `${fontSize}px`,
      color,
      align,
      lineSpacing: 5,
      wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
    }).setOrigin(align === 'center' ? 0.5 : 0, 0);
  }
}
