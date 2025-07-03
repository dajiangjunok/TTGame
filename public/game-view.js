import { GAME_CONFIG } from './game-config.js';

const {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    CANDY_SIZE,
    BULLET_SIZE,
    BULLET_SPEED,
    AUDIO
} = GAME_CONFIG;

// MultiSynq View
export class CandyBattleView extends Multisynq.View {
    constructor(model) {
        super(model);
        this.model = model;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.keys = {};
        this.mouseX = 0;
        this.mouseY = 0;
        this.setupControls();
        this.setupEventListeners();
        this.setupAudio();

        // UI elements
        this.player1ScoreEl = document.getElementById('player1Score');
        this.player2ScoreEl = document.getElementById('player2Score');
        this.playerCountEl = document.getElementById('playerCount');
        this.gameStatusEl = document.getElementById('gameStatus');

        this.subscribe(this.sessionId, "player-joined", (...args) => this.onPlayerJoined(...args));
        this.subscribe(this.sessionId, "player-left", (...args) => this.onPlayerLeft(...args));
        this.subscribe(this.sessionId, "game-start", (...args) => this.onGameStart(...args));
        this.subscribe(this.sessionId, "player-hit", (...args) => this.onPlayerHit(...args));
        this.subscribe(this.sessionId, "game-over", (...args) => this.onGameOver(...args));
        this.subscribe(this.sessionId, "bullet-fired", (...args) => this.onBulletFired(...args));
        this.subscribe(this.sessionId, "obstacles-updated", (...args) => this.onObstaclesUpdated(...args));
        this.subscribe(this.sessionId, "game-reset", (...args) => this.onGameReset(...args));
        this.subscribe(this.sessionId, "player-ready-status", (...args) => this.onPlayerReadyStatus(...args));

        // 获取modal元素
        this.victoryModal = document.getElementById('victoryModal');
        this.victoryTitle = document.getElementById('victoryTitle');
        this.victorySubtitle = document.getElementById('victorySubtitle');

        this.render();
    }

    setupAudio() {
        // 设置背景音乐
        this.bgMusic = new Audio('./bgm.MP3');
        this.bgMusic.loop = true;
        this.bgMusic.volume = AUDIO.BG_MUSIC_VOLUME;

        // 创建音效
        this.shootSound = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dxu2YgBSuO4vfUfzEIJnfL8eMcUhkUe8H2wHkqASN');
        this.hitSound = new Audio('data:audio/wav;base64,UklGRv4CAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YdoCAAC4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQkJCQ');

        this.shootSound.volume = AUDIO.SHOOT_VOLUME;
        this.hitSound.volume = AUDIO.HIT_VOLUME;

        // 用户交互后播放音乐（浏览器政策要求）
        const playMusic = () => {
            this.bgMusic.play().catch(e => console.log('Audio play failed:', e));
            document.removeEventListener('click', playMusic);
            document.removeEventListener('keydown', playMusic);
        };
        document.addEventListener('click', playMusic);
        document.addEventListener('keydown', playMusic);
    }

    setupControls() {
        // 鼠标位置跟踪
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
            this.mouseY = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
        });

        // 鼠标点击射击
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
            const mouseY = (e.clientY - rect.top) * (CANVAS_HEIGHT / rect.height);
            this.publish(this.viewId, "shoot", { mouseX, mouseY });
        });

        // 键盘控制
        document.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) {
                this.keys[e.code] = true;
                this.handleKeyChange(e.code, true);
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.handleKeyChange(e.code, false);
        });
    }

    handleKeyChange(code, pressing) {
        const keyMap = {
            'KeyW': 'up',
            'KeyS': 'down',
            'KeyA': 'left',
            'KeyD': 'right'
        };

        const direction = keyMap[code];
        if (direction) {
            this.publish(this.viewId, "move", { direction, pressing });
        }

        if (code === 'Space' && pressing) {
            this.publish(this.viewId, "shoot", { mouseX: this.mouseX, mouseY: this.mouseY });
        }
    }

    setupEventListeners() {
        // 防止默认的键盘行为
        document.addEventListener('keydown', (e) => {
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        });
    }

    onPlayerJoined(data) {
        const { totalPlayers } = data;
        this.playerCountEl.textContent = `🌐 在线: ${totalPlayers}`;
        if (totalPlayers === 2) {
            this.gameStatusEl.textContent = "⚡ 战斗开始！";
        }
    }

    onPlayerLeft(data) {
        const { totalPlayers } = data;
        this.playerCountEl.textContent = `🌐 在线: ${totalPlayers}`;
        this.gameStatusEl.textContent = "⏳ 等待对手加入...";
    }

    onGameStart() {
        this.gameStatusEl.textContent = "🔥 激战进行中";
    }

    onPlayerHit(data) {
        const { scores } = data;
        this.player1ScoreEl.textContent = `🔴 玩家1: ${scores.player1}分`;
        this.player2ScoreEl.textContent = `🔵 玩家2: ${scores.player2}分`;

        // 添加击中特效
        this.showHitEffect();
    }

    onGameOver(data) {
        const { winner } = data;
        this.gameStatusEl.textContent = `🏆 玩家${winner}获胜！`;

        // 显示胜利模态框
        this.victoryTitle.textContent = `🏆 VICTORY! 🏆`;
        this.victorySubtitle.textContent = `恭喜玩家${winner}获胜！`;

        // 显示模态框
        this.victoryModal.classList.add('show');
    }

    onGameReset(data) {
        const { scores } = data;
        this.player1ScoreEl.textContent = `🔴 玩家1: ${scores.player1}分`;
        this.player2ScoreEl.textContent = `🔵 玩家2: ${scores.player2}分`;
    }

    onBulletFired(bullet) {
        // 可以添加射击音效或特效
        this.showShootEffect(bullet);
    }

    onObstaclesUpdated(data) {
        // 障碍物已在模型中更新，视图会在下一帧渲染时自动使用新的障碍物
        console.log('障碍物已重新生成');
    }

    onPlayerReadyStatus(data) {
        // 处理玩家准备状态
        console.log('Player ready status:', data);
    }

    showHitEffect() {
        // 简单的屏幕震动效果
        this.canvas.style.transform = 'translate(2px, 2px)';
        setTimeout(() => {
            this.canvas.style.transform = 'translate(-2px, -2px)';
            setTimeout(() => {
                this.canvas.style.transform = 'translate(0, 0)';
            }, 50);
        }, 50);
    }

    showShootEffect(bullet) {
        // 在射击位置添加闪光效果
        this.ctx.save();
        this.ctx.globalAlpha = 0.7;
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, 15, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    update() {
        this.render();
    }

    render() {
        // 清空画布
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // 绘制背景网格
        this.drawBackground();

        // 绘制障碍物
        for (const obstacle of this.model.obstacles) {
            this.drawObstacle(obstacle);
        }

        // 绘制玩家
        for (const player of this.model.players.values()) {
            this.drawPlayer(player);
        }

        // 绘制子弹
        for (const bullet of this.model.bullets) {
            this.drawBullet(bullet);
        }

        // 绘制鼠标指针和射击线
        this.drawAimingLine();
    }

    drawBackground() {
        // 绘制科幻网格背景
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;

        // 主网格
        for (let x = 0; x < CANVAS_WIDTH; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CANVAS_HEIGHT);
            this.ctx.stroke();
        }

        for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CANVAS_WIDTH, y);
            this.ctx.stroke();
        }

        // 细网格
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.05)';
        this.ctx.lineWidth = 0.5;
        for (let x = 0; x < CANVAS_WIDTH; x += 25) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, CANVAS_HEIGHT);
            this.ctx.stroke();
        }

        for (let y = 0; y < CANVAS_HEIGHT; y += 25) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(CANVAS_WIDTH, y);
            this.ctx.stroke();
        }

        // 扫描线效果
        const time = Date.now() * 0.001;
        this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 + Math.sin(time * 2) * 0.2})`;
        this.ctx.lineWidth = 2;
        const scanY = (time * 100) % CANVAS_HEIGHT;
        this.ctx.beginPath();
        this.ctx.moveTo(0, scanY);
        this.ctx.lineTo(CANVAS_WIDTH, scanY);
        this.ctx.stroke();
    }

    drawPlayer(player) {
        this.ctx.save();

        const time = Date.now() * 0.003;
        const pulseFactor = 1 + Math.sin(time + player.number) * 0.1;

        // 绘制外部能量场
        const outerGlow = this.ctx.createRadialGradient(
            player.x, player.y, 0,
            player.x, player.y, CANDY_SIZE * 1.2
        );
        outerGlow.addColorStop(0, `rgba(${player.number === 1 ? '255, 50, 50' : '50, 200, 255'}, 0.3)`);
        outerGlow.addColorStop(1, 'transparent');

        this.ctx.fillStyle = outerGlow;
        this.ctx.beginPath();
        this.ctx.arc(player.x, player.y, CANDY_SIZE * 0.8 * pulseFactor, 0, Math.PI * 2);
        this.ctx.fill();

        // 绘制主体六边形
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(time * 0.5);

        // 外壳
        const shellGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, CANDY_SIZE / 2);
        if (player.number === 1) {
            shellGradient.addColorStop(0, '#ff6b6b');
            shellGradient.addColorStop(0.7, '#ff3838');
            shellGradient.addColorStop(1, '#cc1414');
        } else {
            shellGradient.addColorStop(0, '#4ecdc4');
            shellGradient.addColorStop(0.7, '#26a69a');
            shellGradient.addColorStop(1, '#1a7874');
        }

        this.ctx.fillStyle = shellGradient;
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = Math.cos(angle) * (CANDY_SIZE / 2 - 2);
            const y = Math.sin(angle) * (CANDY_SIZE / 2 - 2);
            if (i === 0) this.ctx.moveTo(x, y);
            else this.ctx.lineTo(x, y);
        }
        this.ctx.closePath();
        this.ctx.fill();

        // 内部核心
        const coreGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, CANDY_SIZE / 4);
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.5, player.number === 1 ? '#ffaaaa' : '#aaffff');
        coreGradient.addColorStop(1, player.number === 1 ? '#ff6666' : '#66dddd');

        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, CANDY_SIZE / 4, 0, Math.PI * 2);
        this.ctx.fill();

        // 能量线条
        this.ctx.strokeStyle = player.number === 1 ? '#ff0044' : '#0088ff';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = player.number === 1 ? '#ff0044' : '#0088ff';
        this.ctx.shadowBlur = 8;

        for (let i = 0; i < 3; i++) {
            const angle = (i * Math.PI * 2) / 3 + time;
            this.ctx.beginPath();
            this.ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
            this.ctx.lineTo(Math.cos(angle) * (CANDY_SIZE / 2 - 4), Math.sin(angle) * (CANDY_SIZE / 2 - 4));
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;
        this.ctx.restore();

        // 绘制玩家编号
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Orbitron';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeText(player.number.toString(), player.x, player.y + 4);
        this.ctx.fillText(player.number.toString(), player.x, player.y + 4);

        // 绘制血量
        this.drawHealthBar(player);
    }

    drawHealthBar(player) {
        const barWidth = 45;
        const barHeight = 8;
        const x = player.x - barWidth / 2;
        const y = player.y - CANDY_SIZE / 2 - 20;

        // 外发光效果
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = 4;

        // 背景
        this.ctx.fillStyle = 'rgba(0, 20, 40, 0.8)';
        this.ctx.fillRect(x - 1, y - 1, barWidth + 2, barHeight + 2);

        // 血量条
        const healthPercent = player.health / 3;
        const healthGradient = this.ctx.createLinearGradient(x, y, x + barWidth, y);

        if (healthPercent > 0.6) {
            healthGradient.addColorStop(0, '#00ff88');
            healthGradient.addColorStop(1, '#00cc66');
        } else if (healthPercent > 0.3) {
            healthGradient.addColorStop(0, '#ffaa00');
            healthGradient.addColorStop(1, '#ff8800');
        } else {
            healthGradient.addColorStop(0, '#ff4444');
            healthGradient.addColorStop(1, '#cc0000');
        }

        this.ctx.fillStyle = healthGradient;
        this.ctx.fillRect(x, y, barWidth * healthPercent, barHeight);

        // 边框
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, barWidth, barHeight);

        // 内部分隔线
        for (let i = 1; i < 3; i++) {
            const dividerX = x + (barWidth / 3) * i;
            this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
            this.ctx.beginPath();
            this.ctx.moveTo(dividerX, y);
            this.ctx.lineTo(dividerX, y + barHeight);
            this.ctx.stroke();
        }

        this.ctx.shadowBlur = 0;
    }

    drawBullet(bullet) {
        this.ctx.save();

        const time = Date.now() * 0.01;
        
        // 根据子弹拥有者确定颜色
        const owner = this.model.players.get(bullet.owner);
        const isPlayer1 = owner && owner.number === 1;
        
        // 定义颜色方案
        const colors = isPlayer1 ? {
            trail: 'rgba(255, 100, 100, {alpha})',     // 红色尾迹
            shadow: '#ff4444',                          // 红色阴影
            outer: 'rgba(255, 150, 150, 0.6)',         // 红色外层
            outerFade: 'rgba(255, 100, 100, 0)',       // 红色外层渐变
            core1: '#ffaaaa',                          // 红色内核1
            core2: '#ff6666',                          // 红色内核2
            pulse: '#ff4444'                           // 红色脉冲
        } : {
            trail: 'rgba(0, 255, 255, {alpha})',       // 青色尾迹
            shadow: '#00ffff',                          // 青色阴影
            outer: 'rgba(0, 255, 255, 0.6)',           // 青色外层
            outerFade: 'rgba(0, 255, 255, 0)',         // 青色外层渐变
            core1: '#88ffff',                          // 青色内核1
            core2: '#0088ff',                          // 青色内核2
            pulse: '#00ffff'                           // 青色脉冲
        };

        // 绘制能量尾迹
        const trailLength = 8;
        for (let i = 0; i < trailLength; i++) {
            const alpha = (trailLength - i) / trailLength * 0.6;
            const trailX = bullet.x - (bullet.vx / BULLET_SPEED) * i * 2;
            const trailY = bullet.y - (bullet.vy / BULLET_SPEED) * i * 2;

            this.ctx.fillStyle = colors.trail.replace('{alpha}', alpha);
            this.ctx.beginPath();
            this.ctx.arc(trailX, trailY, BULLET_SIZE / 2 * (1 - i / trailLength), 0, Math.PI * 2);
            this.ctx.fill();
        }

        // 外层能量场
        this.ctx.shadowColor = colors.shadow;
        this.ctx.shadowBlur = 10;

        const outerGradient = this.ctx.createRadialGradient(
            bullet.x, bullet.y, 0,
            bullet.x, bullet.y, BULLET_SIZE
        );
        outerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        outerGradient.addColorStop(0.5, colors.outer);
        outerGradient.addColorStop(1, colors.outerFade);

        this.ctx.fillStyle = outerGradient;
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, BULLET_SIZE * 0.8, 0, Math.PI * 2);
        this.ctx.fill();

        // 内核
        const coreGradient = this.ctx.createRadialGradient(
            bullet.x - 1, bullet.y - 1, 0,
            bullet.x, bullet.y, BULLET_SIZE / 2
        );
        coreGradient.addColorStop(0, '#ffffff');
        coreGradient.addColorStop(0.3, colors.core1);
        coreGradient.addColorStop(1, colors.core2);

        this.ctx.fillStyle = coreGradient;
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, BULLET_SIZE / 2, 0, Math.PI * 2);
        this.ctx.fill();

        // 脉冲环
        this.ctx.strokeStyle = colors.pulse;
        this.ctx.lineWidth = 1;
        this.ctx.globalAlpha = 0.8 + Math.sin(time * 3) * 0.2;
        this.ctx.beginPath();
        this.ctx.arc(bullet.x, bullet.y, BULLET_SIZE / 2 + 2, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    drawObstacle(obstacle) {
        this.ctx.save();

        const time = Date.now() * 0.002;

        // 绘制外部能量护盾
        this.ctx.shadowColor = '#ff6600';
        this.ctx.shadowBlur = 8;

        const shieldGradient = this.ctx.createRadialGradient(
            obstacle.x, obstacle.y, 0,
            obstacle.x, obstacle.y, Math.max(obstacle.width, obstacle.height) * 0.7
        );
        shieldGradient.addColorStop(0, 'rgba(255, 102, 0, 0.1)');
        shieldGradient.addColorStop(0.8, 'rgba(255, 102, 0, 0.3)');
        shieldGradient.addColorStop(1, 'rgba(255, 102, 0, 0)');

        this.ctx.fillStyle = shieldGradient;
        if (obstacle.type === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(obstacle.x, obstacle.y, obstacle.width / 2 * 1.2, 0, Math.PI * 2);
            this.ctx.fill();
        } else {
            this.ctx.fillRect(
                obstacle.x - obstacle.width / 2 * 1.2,
                obstacle.y - obstacle.height / 2 * 1.2,
                obstacle.width * 1.2,
                obstacle.height * 1.2
            );
        }

        // 绘制主体
        const mainGradient = this.ctx.createLinearGradient(
            obstacle.x - obstacle.width / 2, obstacle.y - obstacle.height / 2,
            obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2
        );
        mainGradient.addColorStop(0, '#1a237e');
        mainGradient.addColorStop(0.3, '#283593');
        mainGradient.addColorStop(0.7, '#3949ab');
        mainGradient.addColorStop(1, '#1a237e');

        this.ctx.fillStyle = mainGradient;

        if (obstacle.type === 'circle') {
            this.ctx.beginPath();
            this.ctx.arc(obstacle.x, obstacle.y, obstacle.width / 2, 0, Math.PI * 2);
            this.ctx.fill();

            // 能量环
            this.ctx.strokeStyle = '#ff6600';
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.6 + Math.sin(time * 3) * 0.3;
            this.ctx.beginPath();
            this.ctx.arc(obstacle.x, obstacle.y, obstacle.width / 2 + 3, 0, Math.PI * 2);
            this.ctx.stroke();
        } else {
            this.ctx.fillRect(
                obstacle.x - obstacle.width / 2,
                obstacle.y - obstacle.height / 2,
                obstacle.width,
                obstacle.height
            );

            // 能量边框
            this.ctx.strokeStyle = '#ff6600';
            this.ctx.lineWidth = 2;
            this.ctx.globalAlpha = 0.6 + Math.sin(time * 3) * 0.3;
            this.ctx.strokeRect(
                obstacle.x - obstacle.width / 2 - 2,
                obstacle.y - obstacle.height / 2 - 2,
                obstacle.width + 4,
                obstacle.height + 4
            );
        }

        // 内部科技纹理
        this.ctx.globalAlpha = 0.4;
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 1;

        if (obstacle.type === 'circle') {
            // 圆形内部网格
            const radius = obstacle.width / 2;
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2 + time;
                this.ctx.beginPath();
                this.ctx.moveTo(
                    obstacle.x + Math.cos(angle) * radius * 0.3,
                    obstacle.y + Math.sin(angle) * radius * 0.3
                );
                this.ctx.lineTo(
                    obstacle.x + Math.cos(angle) * radius * 0.8,
                    obstacle.y + Math.sin(angle) * radius * 0.8
                );
                this.ctx.stroke();
            }
        } else {
            // 矩形内部网格
            const lines = 3;
            for (let i = 1; i < lines; i++) {
                const x = obstacle.x - obstacle.width / 2 + (obstacle.width / lines) * i;
                const y = obstacle.y - obstacle.height / 2 + (obstacle.height / lines) * i;

                this.ctx.beginPath();
                this.ctx.moveTo(x, obstacle.y - obstacle.height / 2);
                this.ctx.lineTo(x, obstacle.y + obstacle.height / 2);
                this.ctx.stroke();

                this.ctx.beginPath();
                this.ctx.moveTo(obstacle.x - obstacle.width / 2, y);
                this.ctx.lineTo(obstacle.x + obstacle.width / 2, y);
                this.ctx.stroke();
            }
        }

        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.restore();
    }

    drawAimingLine() {
        const myPlayer = this.model.players.get(this.viewId);
        if (!myPlayer || !this.model.gameStarted) return;

        this.ctx.save();

        // 瞄准线
        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.6)';
        this.ctx.lineWidth = 2;
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = 5;
        this.ctx.setLineDash([8, 4]);

        this.ctx.beginPath();
        this.ctx.moveTo(myPlayer.x, myPlayer.y);
        this.ctx.lineTo(this.mouseX, this.mouseY);
        this.ctx.stroke();

        // 瞄准器
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = '#00ffff';
        this.ctx.lineWidth = 2;
        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.3)';

        // 外圈
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, 8, 0, Math.PI * 2);
        this.ctx.stroke();

        // 内圈
        this.ctx.beginPath();
        this.ctx.arc(this.mouseX, this.mouseY, 3, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();

        // 十字准星
        this.ctx.beginPath();
        this.ctx.moveTo(this.mouseX - 12, this.mouseY);
        this.ctx.lineTo(this.mouseX - 8, this.mouseY);
        this.ctx.moveTo(this.mouseX + 8, this.mouseY);
        this.ctx.lineTo(this.mouseX + 12, this.mouseY);
        this.ctx.moveTo(this.mouseX, this.mouseY - 12);
        this.ctx.lineTo(this.mouseX, this.mouseY - 8);
        this.ctx.moveTo(this.mouseX, this.mouseY + 8);
        this.ctx.lineTo(this.mouseX, this.mouseY + 12);
        this.ctx.stroke();

        this.ctx.shadowBlur = 0;
        this.ctx.restore();
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent * 100);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
}