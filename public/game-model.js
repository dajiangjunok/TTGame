import { GAME_CONFIG } from './game-config.js';

const {
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    CANDY_SIZE,
    PLAYER_SPEED,
    BULLET_SPEED,
    BULLET_SIZE,
    BOUNCE_DAMPING,
    OBSTACLE_COUNT,
    MAX_HEALTH,
    WIN_SCORE,
    SHOOT_COOLDOWN,
    MAX_BULLET_BOUNCES,
    FRAME_TIME,
    PLAYER_SPAWN,
    PLAYER_COLORS
} = GAME_CONFIG;

// MultiSynq Game Model
export class CandyBattleGame extends Multisynq.Model {
    init() {
        this.players = new Map();
        this.bullets = new Set();
        this.obstacles = this.generateObstacles();
        this.gameStarted = false;
        this.scores = { player1: 0, player2: 0 };
        this.gameEnded = false;
        this.playersReady = new Set();

        this.subscribe(this.sessionId, "view-join", this.onPlayerJoin);
        this.subscribe(this.sessionId, "view-exit", this.onPlayerExit);
        this.subscribe(this.sessionId, "player-ready", this.onPlayerReady);

        this.gameLoop();
    }

    generateObstacles() {
        const obstacles = [];
        for (let i = 0; i < OBSTACLE_COUNT; i++) {
            let x, y;
            let validPosition = false;
            let attempts = 0;

            // 尝试找到不与玩家起始位置冲突的障碍物位置
            while (!validPosition && attempts < 50) {
                x = Math.random() * (CANVAS_WIDTH - 100) + 50;
                y = Math.random() * (CANVAS_HEIGHT - 100) + 50;

                // 确保障碍物不在玩家起始位置附近
                const leftSpawn = PLAYER_SPAWN.PLAYER1;
                const rightSpawn = PLAYER_SPAWN.PLAYER2;

                const distToLeft = Math.sqrt((x - leftSpawn.x) ** 2 + (y - leftSpawn.y) ** 2);
                const distToRight = Math.sqrt((x - rightSpawn.x) ** 2 + (y - rightSpawn.y) ** 2);

                if (distToLeft > 80 && distToRight > 80) {
                    validPosition = true;
                }
                attempts++;
            }

            obstacles.push({
                x: x,
                y: y,
                width: 40 + Math.random() * 40,
                height: 40 + Math.random() * 40,
                type: Math.random() > 0.5 ? 'rect' : 'circle'
            });
        }
        return obstacles;
    }

    onPlayerJoin(viewInfo) {
        const { viewId } = viewInfo;
        const playerNumber = this.players.size + 1;

        if (playerNumber <= 2) {
            const spawnPos = playerNumber === 1 ? PLAYER_SPAWN.PLAYER1 : PLAYER_SPAWN.PLAYER2;
            const player = {
                id: viewId,
                number: playerNumber,
                x: spawnPos.x,
                y: spawnPos.y,
                vx: 0,
                vy: 0,
                color: playerNumber === 1 ? PLAYER_COLORS.PLAYER1 : PLAYER_COLORS.PLAYER2,
                health: MAX_HEALTH,
                lastShot: 0
            };

            this.players.set(viewId, player);
            this.subscribe(viewId, "move", this.onPlayerMove);
            this.subscribe(viewId, "shoot", this.onPlayerShoot);

            if (this.players.size === 2) {
                this.gameStarted = true;
                this.publish(this.sessionId, "game-start", {});
            }

            this.publish(this.sessionId, "player-joined", { player, totalPlayers: this.players.size });
        }
    }

    onPlayerExit(viewInfo) {
        const { viewId } = viewInfo;
        this.players.delete(viewId);
        this.unsubscribe(viewId, "move");
        this.unsubscribe(viewId, "shoot");

        if (this.players.size < 2) {
            this.gameStarted = false;
        }

        this.publish(this.sessionId, "player-left", { totalPlayers: this.players.size });
    }

    onPlayerMove(data) {
        const { direction, pressing } = data;
        const player = this.players.get(this.activeSubscription.scope);
        if (!player || !this.gameStarted) return;

        switch (direction) {
            case 'up':
                player.vy = pressing ? -PLAYER_SPEED : 0;
                break;
            case 'down':
                player.vy = pressing ? PLAYER_SPEED : 0;
                break;
            case 'left':
                player.vx = pressing ? -PLAYER_SPEED : 0;
                break;
            case 'right':
                player.vx = pressing ? PLAYER_SPEED : 0;
                break;
        }
    }

    onPlayerShoot(data) {
        const { mouseX, mouseY } = data;
        const player = this.players.get(this.activeSubscription.scope);
        if (!player || !this.gameStarted) return;

        const now = this.now();
        if (now - player.lastShot < SHOOT_COOLDOWN) return; // 射击冷却时间

        player.lastShot = now;

        // 计算鼠标方向
        const dx = mouseX - player.x;
        const dy = mouseY - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance === 0) return; // 避免除零错误

        // 标准化方向向量
        const normalizedDx = (dx / distance) * BULLET_SPEED;
        const normalizedDy = (dy / distance) * BULLET_SPEED;

        const bullet = {
            id: `${player.id}_${now}`,
            x: player.x + (normalizedDx * 2),
            y: player.y + (normalizedDy * 2),
            vx: normalizedDx,
            vy: normalizedDy,
            owner: player.id,
            bounces: 0
        };

        this.bullets.add(bullet);
        this.publish(this.sessionId, "bullet-fired", bullet);
    }

    gameLoop() {
        if (this.gameStarted) {
            this.updatePlayers();
            this.updateBullets();
            this.checkCollisions();
        }

        this.future(FRAME_TIME).gameLoop(); // ~60 FPS
    }

    updatePlayers() {
        for (const player of this.players.values()) {
            const newX = player.x + player.vx;
            const newY = player.y + player.vy;

            // 检查与障碍物的碰撞
            let canMoveX = true;
            let canMoveY = true;

            for (const obstacle of this.obstacles) {
                if (this.checkPlayerObstacleCollision(newX, player.y, obstacle)) {
                    canMoveX = false;
                }
                if (this.checkPlayerObstacleCollision(player.x, newY, obstacle)) {
                    canMoveY = false;
                }
            }

            // 更新位置
            if (canMoveX) player.x = newX;
            if (canMoveY) player.y = newY;

            // 边界检测和弹性碰撞
            if (player.x <= CANDY_SIZE / 2) {
                player.x = CANDY_SIZE / 2;
                player.vx *= -BOUNCE_DAMPING;
            }
            if (player.x >= CANVAS_WIDTH - CANDY_SIZE / 2) {
                player.x = CANVAS_WIDTH - CANDY_SIZE / 2;
                player.vx *= -BOUNCE_DAMPING;
            }
            if (player.y <= CANDY_SIZE / 2) {
                player.y = CANDY_SIZE / 2;
                player.vy *= -BOUNCE_DAMPING;
            }
            if (player.y >= CANVAS_HEIGHT - CANDY_SIZE / 2) {
                player.y = CANVAS_HEIGHT - CANDY_SIZE / 2;
                player.vy *= -BOUNCE_DAMPING;
            }

            // 添加摩擦力
            player.vx *= 0.95;
            player.vy *= 0.95;
        }
    }

    checkPlayerObstacleCollision(playerX, playerY, obstacle) {
        if (obstacle.type === 'circle') {
            const radius = obstacle.width / 2;
            const dx = playerX - obstacle.x;
            const dy = playerY - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < (radius + CANDY_SIZE / 2);
        } else {
            // 矩形碰撞检测
            return playerX - CANDY_SIZE / 2 < obstacle.x + obstacle.width / 2 &&
                playerX + CANDY_SIZE / 2 > obstacle.x - obstacle.width / 2 &&
                playerY - CANDY_SIZE / 2 < obstacle.y + obstacle.height / 2 &&
                playerY + CANDY_SIZE / 2 > obstacle.y - obstacle.height / 2;
        }
    }

    updateBullets() {
        const bulletsToRemove = [];

        for (const bullet of this.bullets) {
            const newX = bullet.x + bullet.vx;
            const newY = bullet.y + bullet.vy;

            // 检查与障碍物的碰撞
            let hitObstacle = false;
            for (const obstacle of this.obstacles) {
                if (this.checkBulletObstacleCollision(newX, newY, obstacle)) {
                    hitObstacle = true;
                    break;
                }
            }

            if (hitObstacle) {
                bulletsToRemove.push(bullet);
                continue;
            }

            bullet.x = newX;
            bullet.y = newY;

            // 子弹边界反弹
            let bounced = false;
            if (bullet.x <= BULLET_SIZE / 2 || bullet.x >= CANVAS_WIDTH - BULLET_SIZE / 2) {
                bullet.vx *= -BOUNCE_DAMPING;
                bullet.x = Math.max(BULLET_SIZE / 2, Math.min(CANVAS_WIDTH - BULLET_SIZE / 2, bullet.x));
                bounced = true;
            }
            if (bullet.y <= BULLET_SIZE / 2 || bullet.y >= CANVAS_HEIGHT - BULLET_SIZE / 2) {
                bullet.vy *= -BOUNCE_DAMPING;
                bullet.y = Math.max(BULLET_SIZE / 2, Math.min(CANVAS_HEIGHT - BULLET_SIZE / 2, bullet.y));
                bounced = true;
            }

            if (bounced) {
                bullet.bounces++;
                if (bullet.bounces > MAX_BULLET_BOUNCES) {
                    bulletsToRemove.push(bullet);
                }
            }
        }

        // 移除被阻挡或超出边界的子弹
        for (const bullet of bulletsToRemove) {
            this.bullets.delete(bullet);
        }
    }

    checkBulletObstacleCollision(bulletX, bulletY, obstacle) {
        if (obstacle.type === 'circle') {
            const radius = obstacle.width / 2;
            const dx = bulletX - obstacle.x;
            const dy = bulletY - obstacle.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance < (radius + BULLET_SIZE / 2);
        } else {
            // 矩形碰撞检测
            return bulletX - BULLET_SIZE / 2 < obstacle.x + obstacle.width / 2 &&
                bulletX + BULLET_SIZE / 2 > obstacle.x - obstacle.width / 2 &&
                bulletY - BULLET_SIZE / 2 < obstacle.y + obstacle.height / 2 &&
                bulletY + BULLET_SIZE / 2 > obstacle.y - obstacle.height / 2;
        }
    }

    checkCollisions() {
        for (const bullet of this.bullets) {
            for (const player of this.players.values()) {
                if (bullet.owner === player.id) continue;

                const dx = bullet.x - player.x;
                const dy = bullet.y - player.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < (BULLET_SIZE + CANDY_SIZE) / 2) {
                    // 命中！
                    player.health--;
                    this.bullets.delete(bullet);

                    // 击退效果
                    const force = 10;
                    player.vx += (dx / distance) * force;
                    player.vy += (dy / distance) * force;

                    // 更新分数
                    const shooter = Array.from(this.players.values()).find(p => p.id === bullet.owner);
                    if (shooter) {
                        if (shooter.number === 1) {
                            this.scores.player1++;
                        } else {
                            this.scores.player2++;
                        }
                    }

                    this.publish(this.sessionId, "player-hit", {
                        victim: player.id,
                        shooter: bullet.owner,
                        scores: this.scores
                    });

                    // 检查游戏结束条件：先达到6分获胜
                    if (this.scores.player1 >= WIN_SCORE || this.scores.player2 >= WIN_SCORE) {
                        const winner = this.scores.player1 >= WIN_SCORE ? 1 : 2;
                        this.gameEnded = true;
                        this.gameStarted = false;
                        this.playersReady.clear();
                        this.publish(this.sessionId, "game-over", {
                            winner: winner,
                            scores: this.scores
                        });
                    } else if (player.health <= 0) {
                        // 血量为0时重置位置但不结束游戏
                        player.health = MAX_HEALTH;
                        const spawnPos = player.number === 1 ? PLAYER_SPAWN.PLAYER1 : PLAYER_SPAWN.PLAYER2;
                        player.x = spawnPos.x;
                        player.y = spawnPos.y;
                        player.vx = 0;
                        player.vy = 0;
                    }

                    break;
                }
            }
        }
    }

    onPlayerReady(data) {
        const playerId = this.activeSubscription.scope;
        this.playersReady.add(playerId);

        this.publish(this.sessionId, "player-ready-status", {
            playerId: playerId,
            readyPlayers: Array.from(this.playersReady),
            totalPlayers: this.players.size
        });

        // 如果所有玩家都准备好了，开始新游戏
        if (this.playersReady.size === this.players.size && this.gameEnded) {
            this.resetGame();
        }
    }

    resetGame() {
        // 重置游戏状态
        this.bullets.clear();
        this.scores = { player1: 0, player2: 0 };
        this.gameEnded = false;
        this.gameStarted = this.players.size === 2;
        this.playersReady.clear();

        // 重新生成障碍物
        this.obstacles = this.generateObstacles();
        for (const player of this.players.values()) {
            player.health = MAX_HEALTH;
            const spawnPos = player.number === 1 ? PLAYER_SPAWN.PLAYER1 : PLAYER_SPAWN.PLAYER2;
            player.x = spawnPos.x;
            player.y = spawnPos.y;
            player.vx = 0;
            player.vy = 0;
        }
        // 通知视图障碍物已更新
        this.publish(this.sessionId, "obstacles-updated", { obstacles: this.obstacles });
        this.publish(this.sessionId, "game-reset", { scores: this.scores });
    }
}