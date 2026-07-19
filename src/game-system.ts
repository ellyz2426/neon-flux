import {
  createSystem,
  PanelUI,
  PanelDocument,
  UIKitDocument,
  UIKit,
  eq,
  Entity,
  InputComponent,
  MeshBasicMaterial,
  BoxGeometry,
  Mesh,
  Group,
  ScreenSpace,
  Follower,
} from '@iwsdk/core';

const COLS = 6;
const ROWS = 8;
const CELL = 0.22;
const GAP = 0.03;
const STEP = CELL + GAP;
const GRID_X0 = -((COLS - 1) * STEP) / 2;
const GRID_Y0 = 0.5;
const GRID_Z = -2.5;
const DROP_Y = GRID_Y0 + (ROWS + 2) * STEP;
const TILE_COLORS = [0x00ffcc, 0xff00cc, 0xffcc00, 0x00ccff, 0xcc00ff];
const COLOR_NAMES = ['cyan', 'magenta', 'gold', 'blue', 'purple'];

interface SaveData {
  highScores: Record<string, number>;
  totalTilesPlaced: number;
  totalMatches: number;
  totalCombos: number;
  gamesPlayed: number;
  achievements: string[];
  volume: number;
  speed: number;
}

function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem('neon-flux-save');
    if (raw) return JSON.parse(raw);
  } catch {}
  return { highScores: {}, totalTilesPlaced: 0, totalMatches: 0, totalCombos: 0, gamesPlayed: 0, achievements: [], volume: 0.7, speed: 1.0 };
}

function saveSave(data: SaveData) {
  localStorage.setItem('neon-flux-save', JSON.stringify(data));
}

const ACHIEVEMENTS = [
  { id: 'first_place', name: 'First Drop', desc: 'Place your first tile' },
  { id: 'first_match', name: 'Color Burst', desc: 'Make your first match' },
  { id: 'combo_2', name: 'Double Up', desc: 'Chain a 2x combo' },
  { id: 'combo_3', name: 'Triple Threat', desc: 'Chain a 3x combo' },
  { id: 'combo_5', name: 'Flux Master', desc: 'Chain a 5x combo' },
  { id: 'score_500', name: 'Rising Star', desc: 'Score 500 points' },
  { id: 'score_1000', name: 'Neon Knight', desc: 'Score 1000 points' },
  { id: 'score_2500', name: 'Grid Lord', desc: 'Score 2500 points' },
  { id: 'score_5000', name: 'Flux Legend', desc: 'Score 5000 points' },
  { id: 'matches_10', name: 'Matcher', desc: 'Make 10 matches in one game' },
  { id: 'matches_25', name: 'Chain Reactor', desc: 'Make 25 matches in one game' },
  { id: 'clear_col', name: 'Column Clear', desc: 'Clear an entire column' },
  { id: 'clear_row', name: 'Row Sweep', desc: 'Clear an entire row' },
  { id: 'tiles_50', name: 'Steady Hands', desc: 'Place 50 tiles total' },
  { id: 'tiles_200', name: 'Tile Veteran', desc: 'Place 200 tiles total' },
  { id: 'tiles_500', name: 'Tile Master', desc: 'Place 500 tiles total' },
  { id: 'games_5', name: 'Regular', desc: 'Play 5 games' },
  { id: 'games_20', name: 'Dedicated', desc: 'Play 20 games' },
  { id: 'zen_500', name: 'Zen Flow', desc: 'Score 500 in Zen mode' },
  { id: 'rush_1000', name: 'Speed Demon', desc: 'Score 1000 in Rush mode' },
];

type GameState = 'menu' | 'playing' | 'paused' | 'gameover';
type GameMode = 'classic' | 'rush' | 'zen' | 'challenge';

export class GameSystem extends createSystem({
  menuQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/menu.json')] },
  hudQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/hud.json')] },
  pauseQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/pause.json')] },
  resultsQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/results.json')] },
  settingsQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/settings.json')] },
  tutorialQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/tutorial.json')] },
  achvQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/achvlist.json')] },
  previewQ: { required: [PanelUI, PanelDocument], where: [eq(PanelUI, 'config', './ui/preview.json')] },
}) {
  private state: GameState = 'menu';
  private mode: GameMode = 'classic';
  private save = loadSave();
  private score = 0;
  private level = 1;
  private combo = 0;
  private matchesThisGame = 0;
  private tilesPlacedThisGame = 0;
  private dropTimer = 0;
  private dropInterval = 3.0;
  private selectedCol = 3;
  private curColor = 0;
  private nextColor = 0;

  private grid: number[][] = [];
  private gridMeshes: (Mesh | null)[][] = [];
  private gridGroup = new Group();
  private curTileMesh: Mesh | null = null;
  private selectorMesh: Mesh | null = null;

  private menuEntity: Entity | null = null;
  private hudEntity: Entity | null = null;
  private pauseEntity: Entity | null = null;
  private resultsEntity: Entity | null = null;
  private settingsEntity: Entity | null = null;
  private tutorialEntity: Entity | null = null;
  private achvEntity: Entity | null = null;
  private previewEntity: Entity | null = null;

  private prevTrigger = false;
  private prevGrip = false;
  private prevKeys: Record<string, boolean> = {};
  private newAchievements: string[] = [];
  private _keyState: Record<string, boolean> = {};
  private _keyListenerSet = false;

  init() {
    this.initGrid();
    this.createVisuals();
    this.createPanels();
    this.nextColor = this.randomColor();
    this.spawnNextTile();
    this.bindPanelEvents();
  }

  private getAudio(): any {
    const systems = (this.world as any)._systems || [];
    for (const s of systems) {
      if (s?.playClick) return s;
    }
    return null;
  }

  private initGrid() {
    this.grid = [];
    this.gridMeshes = [];
    for (let c = 0; c < COLS; c++) {
      this.grid.push(new Array(ROWS).fill(-1));
      this.gridMeshes.push(new Array(ROWS).fill(null));
    }
  }

  private createVisuals() {
    const scene = this.world.scene;
    scene.add(this.gridGroup);

    const frameMat = new MeshBasicMaterial({ color: 0x003366, transparent: true, opacity: 0.5 });
    const frameW = COLS * STEP + 0.1;
    const frameH = ROWS * STEP + 0.1;

    const bot = new Mesh(new BoxGeometry(frameW, 0.03, 0.03), frameMat);
    bot.position.set(0, GRID_Y0 - STEP * 0.5, GRID_Z);
    this.gridGroup.add(bot);

    const top = new Mesh(new BoxGeometry(frameW, 0.03, 0.03), frameMat);
    top.position.set(0, GRID_Y0 + (ROWS - 0.5) * STEP, GRID_Z);
    this.gridGroup.add(top);

    const left = new Mesh(new BoxGeometry(0.03, frameH, 0.03), frameMat);
    left.position.set(GRID_X0 - STEP * 0.5, GRID_Y0 + (ROWS - 1) * STEP / 2, GRID_Z);
    this.gridGroup.add(left);

    const right = new Mesh(new BoxGeometry(0.03, frameH, 0.03), frameMat);
    right.position.set(-GRID_X0 + STEP * 0.5, GRID_Y0 + (ROWS - 1) * STEP / 2, GRID_Z);
    this.gridGroup.add(right);

    const hlMat = new MeshBasicMaterial({ color: 0x002244, transparent: true, opacity: 0.15 });
    for (let c = 0; c < COLS; c++) {
      const hl = new Mesh(new BoxGeometry(CELL, ROWS * STEP, 0.01), hlMat);
      hl.position.set(GRID_X0 + c * STEP, GRID_Y0 + (ROWS - 1) * STEP / 2, GRID_Z - 0.02);
      this.gridGroup.add(hl);
    }

    const selMat = new MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.25 });
    this.selectorMesh = new Mesh(new BoxGeometry(CELL + 0.04, ROWS * STEP, 0.01), selMat);
    this.selectorMesh.position.set(GRID_X0 + this.selectedCol * STEP, GRID_Y0 + (ROWS - 1) * STEP / 2, GRID_Z - 0.01);
    this.gridGroup.add(this.selectorMesh);

    const cellOutlineMat = new MeshBasicMaterial({ color: 0x002244, transparent: true, opacity: 0.3 });
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const outline = new Mesh(new BoxGeometry(CELL, CELL, 0.005), cellOutlineMat);
        outline.position.set(GRID_X0 + c * STEP, GRID_Y0 + r * STEP, GRID_Z - 0.03);
        this.gridGroup.add(outline);
      }
    }
  }

  private randomColor(): number {
    const numColors = this.mode === 'rush' ? 5 : Math.min(3 + Math.floor(this.level / 3), 5);
    return Math.floor(Math.random() * numColors);
  }

  private spawnNextTile() {
    if (this.curTileMesh) this.gridGroup.remove(this.curTileMesh);
    this.curColor = this.nextColor;
    this.nextColor = this.randomColor();
    const mat = new MeshBasicMaterial({ color: TILE_COLORS[this.curColor], transparent: true, opacity: 0.9 });
    this.curTileMesh = new Mesh(new BoxGeometry(CELL - 0.02, CELL - 0.02, CELL - 0.02), mat);
    this.curTileMesh.position.set(GRID_X0 + this.selectedCol * STEP, DROP_Y, GRID_Z);
    this.gridGroup.add(this.curTileMesh);
    this.dropTimer = 0;
  }

  private createPanels() {
    const w = this.world;

    const makePanel = (config: string): Entity => {
      const g = new Group();
      g.position.set(0, 1.6, -1.5);
      w.scene.add(g);
      const e = w.createTransformEntity(g);
      e.addComponent(PanelUI, { config });
      return e;
    };

    this.menuEntity = makePanel('./ui/menu.json');
    this.hudEntity = makePanel('./ui/hud.json');
    this.pauseEntity = makePanel('./ui/pause.json');
    this.resultsEntity = makePanel('./ui/results.json');
    this.settingsEntity = makePanel('./ui/settings.json');
    this.tutorialEntity = makePanel('./ui/tutorial.json');
    this.achvEntity = makePanel('./ui/achvlist.json');
    this.previewEntity = makePanel('./ui/preview.json');

    // Initially show menu, hide everything else
    this.showPanel('menu');
  }

  private bindPanelEvents() {
    this.queries.menuQ.subscribe('qualify', (e) => {
      const doc = this.getDoc(e);
      if (!doc) return;
      this.btn(e, 'btn-classic', () => this.startGame('classic'));
      this.btn(e, 'btn-rush', () => this.startGame('rush'));
      this.btn(e, 'btn-zen', () => this.startGame('zen'));
      this.btn(e, 'btn-challenge', () => this.startGame('challenge'));
      this.btn(e, 'btn-settings', () => this.showPanel('settings'));
      this.btn(e, 'btn-achievements', () => this.showPanel('achievements'));
      this.btn(e, 'btn-tutorial', () => this.showPanel('tutorial'));
      this.updateMenuStats();
    });

    this.queries.hudQ.subscribe('qualify', () => {});

    this.queries.pauseQ.subscribe('qualify', (e) => {
      this.btn(e, 'btn-resume', () => this.resumeGame());
      this.btn(e, 'btn-menu', () => this.returnToMenu());
    });

    this.queries.resultsQ.subscribe('qualify', (e) => {
      this.btn(e, 'btn-retry', () => this.startGame(this.mode));
      this.btn(e, 'btn-menu', () => this.returnToMenu());
    });

    this.queries.settingsQ.subscribe('qualify', (e) => {
      const doc = this.getDoc(e);
      if (!doc) return;
      this.btn(e, 'btn-vol-up', () => {
        this.save.volume = Math.min(1, this.save.volume + 0.1);
        this.getAudio()?.setVolume(this.save.volume);
        saveSave(this.save);
        this.updateSettings();
      });
      this.btn(e, 'btn-vol-down', () => {
        this.save.volume = Math.max(0, this.save.volume - 0.1);
        this.getAudio()?.setVolume(this.save.volume);
        saveSave(this.save);
        this.updateSettings();
      });
      this.btn(e, 'btn-speed-up', () => {
        this.save.speed = Math.min(2, this.save.speed + 0.25);
        saveSave(this.save);
        this.updateSettings();
      });
      this.btn(e, 'btn-speed-down', () => {
        this.save.speed = Math.max(0.5, this.save.speed - 0.25);
        saveSave(this.save);
        this.updateSettings();
      });
      this.btn(e, 'btn-back', () => this.showPanel('menu'));
      this.updateSettings();
    });

    this.queries.tutorialQ.subscribe('qualify', (e) => {
      this.btn(e, 'btn-back', () => this.showPanel('menu'));
    });

    this.queries.achvQ.subscribe('qualify', (e) => {
      this.btn(e, 'btn-back', () => this.showPanel('menu'));
      this.updateAchievements();
    });

    this.queries.previewQ.subscribe('qualify', () => {});
  }

  private getDoc(e: Entity): UIKitDocument | undefined {
    return e.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
  }

  private btn(e: Entity, id: string, handler: () => void) {
    const doc = this.getDoc(e);
    (doc?.getElementById(id) as UIKit.Text | undefined)?.addEventListener('click', handler);
  }

  private setText(entity: Entity | null, id: string, text: string) {
    if (!entity) return;
    const doc = this.getDoc(entity);
    (doc?.getElementById(id) as UIKit.Text | undefined)?.setProperties({ text });
  }

  private showPanel(panel: string) {
    const allPanels = ['menu', 'hud', 'pause', 'results', 'settings', 'tutorial', 'achievements', 'preview'];
    const entities: Record<string, Entity | null> = {
      menu: this.menuEntity, hud: this.hudEntity, pause: this.pauseEntity,
      results: this.resultsEntity, settings: this.settingsEntity,
      tutorial: this.tutorialEntity, achievements: this.achvEntity, preview: this.previewEntity,
    };

    for (const p of allPanels) {
      const e = entities[p];
      if (!e) continue;
      const obj = e.object3D as Group | undefined;

      if (p === panel) {
        if (obj) obj.visible = true;
        if ((p === 'hud' || p === 'preview') && this.state === 'playing') {
          if (!e.hasComponent(ScreenSpace)) e.addComponent(ScreenSpace, {});
          if (!e.hasComponent(Follower)) {
            e.addComponent(Follower, { target: this.world.player.head });
            const fov = e.getVectorView(Follower, 'offsetPosition');
            if (p === 'hud') { fov[0] = 0; fov[1] = 0.12; fov[2] = -0.5; }
            else { fov[0] = 0.2; fov[1] = 0.08; fov[2] = -0.5; }
          }
        }
      } else {
        if (obj) obj.visible = false;
        if (p === 'hud' || p === 'preview') {
          if (e.hasComponent(ScreenSpace)) e.removeComponent(ScreenSpace);
          if (e.hasComponent(Follower)) e.removeComponent(Follower);
        }
      }
    }
    this.getAudio()?.playClick();
  }

  private updateMenuStats() {
    const best = Math.max(0, ...Object.values(this.save.highScores));
    this.setText(this.menuEntity, 'txt-best', 'Best: ' + best);
    this.setText(this.menuEntity, 'txt-games', 'Games: ' + this.save.gamesPlayed);
  }

  private updateSettings() {
    this.setText(this.settingsEntity, 'txt-volume', 'Volume: ' + Math.round(this.save.volume * 100) + '%');
    this.setText(this.settingsEntity, 'txt-speed', 'Speed: ' + this.save.speed.toFixed(2) + 'x');
  }

  private updateAchievements() {
    if (!this.achvEntity) return;
    const doc = this.getDoc(this.achvEntity);
    if (!doc) return;
    for (let i = 0; i < ACHIEVEMENTS.length; i++) {
      const a = ACHIEVEMENTS[i];
      const unlocked = this.save.achievements.includes(a.id);
      (doc.getElementById('achv-' + i) as UIKit.Text | undefined)?.setProperties({
        text: (unlocked ? '[*] ' : '[ ] ') + a.name + ' - ' + a.desc
      });
    }
  }

  private startGame(mode: GameMode) {
    this.mode = mode;
    this.state = 'playing';
    this.score = 0;
    this.level = 1;
    this.combo = 0;
    this.matchesThisGame = 0;
    this.tilesPlacedThisGame = 0;
    this.dropInterval = mode === 'rush' ? 1.5 : 3.0;
    this.selectedCol = Math.floor(COLS / 2);
    this.newAchievements = [];

    this.clearGrid();
    this.nextColor = this.randomColor();
    this.spawnNextTile();
    this.gridGroup.visible = true;
    if (this.curTileMesh) this.curTileMesh.visible = true;

    // Show HUD + preview, hide others
    this.showPanel('__none__');
    // Now manually show hud and preview
    const hudObj = this.hudEntity?.object3D as Group | undefined;
    const prevObj = this.previewEntity?.object3D as Group | undefined;
    if (hudObj) hudObj.visible = true;
    if (prevObj) prevObj.visible = true;
    if (this.hudEntity) {
      if (!this.hudEntity.hasComponent(ScreenSpace)) this.hudEntity.addComponent(ScreenSpace, {});
      if (!this.hudEntity.hasComponent(Follower)) {
        this.hudEntity.addComponent(Follower, { target: this.world.player.head });
        const fov = this.hudEntity.getVectorView(Follower, 'offsetPosition');
        fov[0] = 0; fov[1] = 0.12; fov[2] = -0.5;
      }
    }
    if (this.previewEntity) {
      if (!this.previewEntity.hasComponent(ScreenSpace)) this.previewEntity.addComponent(ScreenSpace, {});
      if (!this.previewEntity.hasComponent(Follower)) {
        this.previewEntity.addComponent(Follower, { target: this.world.player.head });
        const fov = this.previewEntity.getVectorView(Follower, 'offsetPosition');
        fov[0] = 0.2; fov[1] = 0.08; fov[2] = -0.5;
      }
    }
  }

  private clearGrid() {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        this.grid[c][r] = -1;
        if (this.gridMeshes[c][r]) {
          this.gridGroup.remove(this.gridMeshes[c][r]!);
          this.gridMeshes[c][r] = null;
        }
      }
    }
  }

  private pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.showPanel('pause');
    this.setText(this.pauseEntity, 'txt-score', 'Score: ' + this.score);
  }

  private resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.showPanel('__none__');
    // Re-show HUD + preview
    const hudObj = this.hudEntity?.object3D as Group | undefined;
    const prevObj = this.previewEntity?.object3D as Group | undefined;
    if (hudObj) hudObj.visible = true;
    if (prevObj) prevObj.visible = true;
    if (this.hudEntity && !this.hudEntity.hasComponent(ScreenSpace)) {
      this.hudEntity.addComponent(ScreenSpace, {});
      this.hudEntity.addComponent(Follower, { target: this.world.player.head });
      const f = this.hudEntity.getVectorView(Follower, 'offsetPosition');
      f[0] = 0; f[1] = 0.12; f[2] = -0.5;
    }
    if (this.previewEntity && !this.previewEntity.hasComponent(ScreenSpace)) {
      this.previewEntity.addComponent(ScreenSpace, {});
      this.previewEntity.addComponent(Follower, { target: this.world.player.head });
      const f = this.previewEntity.getVectorView(Follower, 'offsetPosition');
      f[0] = 0.2; f[1] = 0.08; f[2] = -0.5;
    }
  }

  private returnToMenu() {
    this.state = 'menu';
    this.clearGrid();
    if (this.curTileMesh) this.curTileMesh.visible = false;
    this.showPanel('menu');
    this.updateMenuStats();
  }

  private gameOver() {
    this.state = 'gameover';
    this.save.gamesPlayed++;
    const key = this.mode;
    if (!this.save.highScores[key] || this.score > this.save.highScores[key]) {
      this.save.highScores[key] = this.score;
    }
    this.checkAchievements();
    saveSave(this.save);
    this.getAudio()?.playGameOver();

    this.showPanel('results');
    const isNew = this.score === this.save.highScores[key];
    this.setText(this.resultsEntity, 'txt-title', isNew ? 'NEW HIGH SCORE!' : 'GAME OVER');
    this.setText(this.resultsEntity, 'txt-score', 'Score: ' + this.score);
    this.setText(this.resultsEntity, 'txt-level', 'Level: ' + this.level);
    this.setText(this.resultsEntity, 'txt-matches', 'Matches: ' + this.matchesThisGame);
    this.setText(this.resultsEntity, 'txt-tiles', 'Tiles: ' + this.tilesPlacedThisGame);
    this.setText(this.resultsEntity, 'txt-best', 'Best: ' + (this.save.highScores[key] || 0));
    if (this.newAchievements.length > 0) {
      const names = this.newAchievements.map(id => ACHIEVEMENTS.find(a => a.id === id)?.name || id);
      this.setText(this.resultsEntity, 'txt-unlocked', 'Unlocked: ' + names.join(', '));
    } else {
      this.setText(this.resultsEntity, 'txt-unlocked', '');
    }
  }

  private placeTile() {
    const col = this.selectedCol;
    let row = -1;
    for (let r = 0; r < ROWS; r++) {
      if (this.grid[col][r] === -1) { row = r; break; }
    }
    if (row === -1) { this.getAudio()?.playMiss(); return; }

    this.grid[col][row] = this.curColor;
    this.tilesPlacedThisGame++;
    this.save.totalTilesPlaced++;

    const mat = new MeshBasicMaterial({ color: TILE_COLORS[this.curColor] });
    const tile = new Mesh(new BoxGeometry(CELL - 0.02, CELL - 0.02, CELL - 0.02), mat);
    tile.position.set(GRID_X0 + col * STEP, GRID_Y0 + row * STEP, GRID_Z);
    this.gridGroup.add(tile);
    this.gridMeshes[col][row] = tile;
    this.getAudio()?.playDrop(this.curColor);

    const cleared = this.checkMatches();
    if (cleared > 0) {
      this.combo++;
      this.matchesThisGame++;
      this.save.totalMatches++;
      this.score += cleared * 10 * this.combo * this.level;
      if (this.combo > 1) { this.save.totalCombos++; this.getAudio()?.playCombo(); }
      else { this.getAudio()?.playMatch(cleared); }
      this.applyGravity();
      let chain = this.checkMatches();
      while (chain > 0) {
        this.combo++;
        this.matchesThisGame++;
        this.save.totalMatches++;
        this.score += chain * 10 * this.combo * this.level;
        this.getAudio()?.playCombo();
        this.applyGravity();
        chain = this.checkMatches();
      }
    } else {
      this.combo = 0;
    }

    const newLevel = Math.floor(this.tilesPlacedThisGame / 15) + 1;
    if (newLevel > this.level) {
      this.level = newLevel;
      this.dropInterval = Math.max(0.8, this.dropInterval - 0.2);
    }

    let gameOverCheck = false;
    for (let c = 0; c < COLS; c++) {
      if (this.grid[c][ROWS - 1] !== -1) { gameOverCheck = true; break; }
    }
    if (gameOverCheck && this.mode !== 'zen') { this.gameOver(); return; }

    this.spawnNextTile();
  }

  private checkMatches(): number {
    const toRemove = new Set<string>();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 3; c++) {
        const color = this.grid[c][r];
        if (color === -1) continue;
        if (this.grid[c + 1][r] === color && this.grid[c + 2][r] === color) {
          let end = c + 2;
          while (end + 1 < COLS && this.grid[end + 1][r] === color) end++;
          for (let i = c; i <= end; i++) toRemove.add(i + ',' + r);
        }
      }
    }
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const color = this.grid[c][r];
        if (color === -1) continue;
        if (this.grid[c][r + 1] === color && this.grid[c][r + 2] === color) {
          let end = r + 2;
          while (end + 1 < ROWS && this.grid[c][end + 1] === color) end++;
          for (let i = r; i <= end; i++) toRemove.add(c + ',' + i);
        }
      }
    }
    for (let c = 0; c <= COLS - 3; c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const color = this.grid[c][r];
        if (color === -1) continue;
        if (this.grid[c + 1][r + 1] === color && this.grid[c + 2][r + 2] === color) {
          let len = 3;
          while (c + len < COLS && r + len < ROWS && this.grid[c + len][r + len] === color) len++;
          for (let i = 0; i < len; i++) toRemove.add((c + i) + ',' + (r + i));
        }
      }
    }
    for (let c = 2; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const color = this.grid[c][r];
        if (color === -1) continue;
        if (this.grid[c - 1][r + 1] === color && this.grid[c - 2][r + 2] === color) {
          let len = 3;
          while (c - len >= 0 && r + len < ROWS && this.grid[c - len][r + len] === color) len++;
          for (let i = 0; i < len; i++) toRemove.add((c - i) + ',' + (r + i));
        }
      }
    }

    for (const key of toRemove) {
      const [cs, rs] = key.split(',');
      const c = parseInt(cs); const r = parseInt(rs);
      this.grid[c][r] = -1;
      if (this.gridMeshes[c][r]) {
        this.gridGroup.remove(this.gridMeshes[c][r]!);
        this.gridMeshes[c][r] = null;
      }
    }

    if (toRemove.size > 0) {
      for (let c = 0; c < COLS; c++) {
        let allEmpty = true;
        for (let r = 0; r < ROWS; r++) if (this.grid[c][r] !== -1) { allEmpty = false; break; }
        if (allEmpty && this.tilesPlacedThisGame > 0) this.unlockAchievement('clear_col');
      }
    }
    return toRemove.size;
  }

  private applyGravity() {
    for (let c = 0; c < COLS; c++) {
      let w = 0;
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[c][r] !== -1) {
          if (r !== w) {
            this.grid[c][w] = this.grid[c][r];
            this.grid[c][r] = -1;
            if (this.gridMeshes[c][r]) {
              this.gridMeshes[c][w] = this.gridMeshes[c][r];
              this.gridMeshes[c][r] = null;
              this.gridMeshes[c][w]!.position.y = GRID_Y0 + w * STEP;
            }
          }
          w++;
        }
      }
    }
  }

  private unlockAchievement(id: string) {
    if (this.save.achievements.includes(id)) return;
    this.save.achievements.push(id);
    this.newAchievements.push(id);
    saveSave(this.save);
  }

  private checkAchievements() {
    if (this.tilesPlacedThisGame > 0) this.unlockAchievement('first_place');
    if (this.matchesThisGame > 0) this.unlockAchievement('first_match');
    if (this.combo >= 2) this.unlockAchievement('combo_2');
    if (this.combo >= 3) this.unlockAchievement('combo_3');
    if (this.combo >= 5) this.unlockAchievement('combo_5');
    if (this.score >= 500) this.unlockAchievement('score_500');
    if (this.score >= 1000) this.unlockAchievement('score_1000');
    if (this.score >= 2500) this.unlockAchievement('score_2500');
    if (this.score >= 5000) this.unlockAchievement('score_5000');
    if (this.matchesThisGame >= 10) this.unlockAchievement('matches_10');
    if (this.matchesThisGame >= 25) this.unlockAchievement('matches_25');
    if (this.save.totalTilesPlaced >= 50) this.unlockAchievement('tiles_50');
    if (this.save.totalTilesPlaced >= 200) this.unlockAchievement('tiles_200');
    if (this.save.totalTilesPlaced >= 500) this.unlockAchievement('tiles_500');
    if (this.save.gamesPlayed >= 5) this.unlockAchievement('games_5');
    if (this.save.gamesPlayed >= 20) this.unlockAchievement('games_20');
    if (this.mode === 'zen' && this.score >= 500) this.unlockAchievement('zen_500');
    if (this.mode === 'rush' && this.score >= 1000) this.unlockAchievement('rush_1000');
  }

  private keyDown(key: string): boolean {
    if (!this._keyListenerSet) {
      this._keyListenerSet = true;
      window.addEventListener('keydown', (e) => { this._keyState[e.key] = true; });
      window.addEventListener('keyup', (e) => { this._keyState[e.key] = false; });
    }
    return this._keyState[key] ?? false;
  }

  private updateSelectorPos() {
    if (this.selectorMesh) this.selectorMesh.position.x = GRID_X0 + this.selectedCol * STEP;
    if (this.curTileMesh) this.curTileMesh.position.x = GRID_X0 + this.selectedCol * STEP;
  }

  private handleInput(delta: number) {
    let triggerPressed = false;
    let gripPressed = false;
    let stickX = 0;

    try {
      const inp = this.world.input as unknown as { getButtonValue(id: string): number; getAxesValues(id: string): { x: number; y: number } };
      triggerPressed = inp.getButtonValue(InputComponent.Trigger) > 0.5;
      gripPressed = inp.getButtonValue(InputComponent.Squeeze) > 0.5;
      const axes = inp.getAxesValues(InputComponent.Thumbstick);
      stickX = axes?.x ?? 0;
    } catch {}

    const leftKey = this.keyDown('ArrowLeft') || this.keyDown('a');
    const rightKey = this.keyDown('ArrowRight') || this.keyDown('d');
    const spaceKey = this.keyDown(' ');
    const escKey = this.keyDown('Escape');

    const moveLeft = (stickX < -0.5 && !this.prevKeys['stickLeft']) || (leftKey && !this.prevKeys['left']);
    const moveRight = (stickX > 0.5 && !this.prevKeys['stickRight']) || (rightKey && !this.prevKeys['right']);

    if (this.state === 'playing') {
      if (moveLeft && this.selectedCol > 0) { this.selectedCol--; this.updateSelectorPos(); this.getAudio()?.playClick(); }
      if (moveRight && this.selectedCol < COLS - 1) { this.selectedCol++; this.updateSelectorPos(); this.getAudio()?.playClick(); }
      const triggerDown = (triggerPressed && !this.prevTrigger) || (spaceKey && !this.prevKeys['space']);
      if (triggerDown) this.placeTile();
      const gripDown = (gripPressed && !this.prevGrip) || (escKey && !this.prevKeys['esc']);
      if (gripDown) this.pauseGame();
      this.dropTimer += delta * this.save.speed;
      if (this.dropTimer >= this.dropInterval) { this.dropTimer = 0; this.placeTile(); }
    } else if (this.state === 'paused') {
      const gripDown = (gripPressed && !this.prevGrip) || (escKey && !this.prevKeys['esc']);
      if (gripDown) this.resumeGame();
    }

    this.prevTrigger = triggerPressed;
    this.prevGrip = gripPressed;
    this.prevKeys['stickLeft'] = stickX < -0.5;
    this.prevKeys['stickRight'] = stickX > 0.5;
    this.prevKeys['left'] = leftKey;
    this.prevKeys['right'] = rightKey;
    this.prevKeys['space'] = spaceKey;
    this.prevKeys['esc'] = escKey;
  }

  private updateHUD() {
    this.setText(this.hudEntity, 'txt-score', 'Score: ' + this.score);
    this.setText(this.hudEntity, 'txt-level', 'Lv: ' + this.level);
    this.setText(this.hudEntity, 'txt-combo', this.combo > 1 ? this.combo + 'x COMBO' : '');
    this.setText(this.hudEntity, 'txt-lives', this.mode === 'zen' ? 'ZEN' : '');
    this.setText(this.previewEntity, 'txt-color', COLOR_NAMES[this.nextColor]);
  }

  update(delta: number, time: number) {
    if (this.state === 'playing' || this.state === 'paused') this.handleInput(delta);
    if (this.state === 'playing') {
      this.updateHUD();
      if (this.curTileMesh) {
        this.curTileMesh.position.y = DROP_Y + Math.sin(time * 3) * 0.03;
        this.curTileMesh.rotation.y = time * 0.5;
      }
      this.checkAchievements();
    }
  }
}
