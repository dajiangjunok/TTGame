// 游戏常量配置
export const GAME_CONFIG = {
    // 画布配置
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    
    // 游戏对象尺寸
    CANDY_SIZE: 25,
    BULLET_SIZE: 8,
    
    // 移动速度
    PLAYER_SPEED: 5,
    BULLET_SPEED: 8,
    
    // 物理参数
    BOUNCE_DAMPING: 0.8,
    
    // 游戏设置
    OBSTACLE_COUNT: 8,
    MAX_HEALTH: 3,
    WIN_SCORE: 6,
    SHOOT_COOLDOWN: 300, // 毫秒
    MAX_BULLET_BOUNCES: 5,
    
    // 游戏循环
    GAME_FPS: 60,
    FRAME_TIME: 16, // 1000/60
    
    // 玩家起始位置
    PLAYER_SPAWN: {
        PLAYER1: { x: 100, y: 300 }, // CANVAS_HEIGHT / 2
        PLAYER2: { x: 700, y: 300 }  // CANVAS_WIDTH - 100
    },
    
    // 玩家颜色
    PLAYER_COLORS: {
        PLAYER1: '#ff6b6b',
        PLAYER2: '#4ecdc4'
    },
    
    // 音效配置
    AUDIO: {
        BG_MUSIC_VOLUME: 0.3,
        SHOOT_VOLUME: 0.2,
        HIT_VOLUME: 0.3
    }
};