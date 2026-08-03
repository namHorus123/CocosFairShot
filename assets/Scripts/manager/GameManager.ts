import { _decorator, Component } from 'cc';
import { LevelController } from './LevelController';
import { SpawnGun } from '../spawn/SpawnGun';
import { SpawnTable } from '../spawn/SpawnTable';
import { MapSpawner } from '../spawn/MapSpawner';
import EventManager from '../Utility/EventManager';
import { GlobalEvent } from '../Utility/Event/GlobalEvent';
import { InputController } from './InputController';

const { ccclass, property } = _decorator;

export enum GameplayState {
    Initializing,
    Playing,
    Victory,
    GameOver
}

@ccclass('GameManager')
export class GameManager extends Component {

    public static instance: GameManager | null = null;

    // --- CẤU HÌNH LEVEL ---

    @property({ tooltip: 'Số lượng đạn tối đa người chơi được bắn' })
    public bulletLimit: number = 10;

    @property({ tooltip: 'Thời gian chờ (giây) sau khi hết đạn để xác định thua (phòng khi viên đạn cuối đang bay trúng đích)' })
    public loseCountdownDuration: number = 3.0;

    @property({ tooltip: 'Thời gian chờ (giây) trước khi chuyển sang map tiếp theo' })
    public mapTransitionDelay: number = 1.0;

    // --- STATE TRACKING ---
    private _currentState: GameplayState = GameplayState.Initializing;

    private _totalObjects: number = 0;
    private _remainingObjects: number = 0;
    private _bulletsFired: number = 0;

    private _isLoseCountdown: boolean = false;

    // Getter
    public get currentState(): GameplayState { return this._currentState; }
    public get remainingBullets(): number { return this.bulletLimit - this._bulletsFired; }
    public get totalObjects(): number { return this._totalObjects; }
    public get remainingObjects(): number { return this._remainingObjects; }

    onLoad() {
        GameManager.instance = this;
    }

    onDestroy() {
        // Tránh memory leak khi scene/node bị destroy
        if (GameManager.instance === this) {
            GameManager.instance = null;
        }
    }

    start() {
        // Tối ưu Playable: Không cần Load Data Level lằng nhằng (CancellationToken, async/await), mọi thứ đã setup trên Editor
        this.initializeGame();
    }

    public initializeGame() {
        // Tối ưu: Dọn dẹp mọi timer cũ nếu có (cực kỳ quan trọng khi user bấm nút Replay trong Playable)
        this.unscheduleAllCallbacks();

        this._currentState = GameplayState.Initializing;
        this._bulletsFired = 0;
        this._isLoseCountdown = false;

        // Reset count
        this._totalObjects = 0;
        this._remainingObjects = 0;

        if (MapSpawner.instance) {
            MapSpawner.instance.loadMap(0); // Map đầu tiên
        }

        // Kích hoạt Spawn (Súng, Bàn, Kẻ địch)
        if (SpawnTable.instance) SpawnTable.instance.spawn();
        if (SpawnGun.instance) SpawnGun.instance.spawn();

        this._currentState = GameplayState.Playing;
        EventManager.instance.emit(GlobalEvent.ON_BULLETS_CHANGED, this.remainingBullets, this.bulletLimit);
        //  console.log(`[GameManager] Game Ready! Đạn: ${this.bulletLimit}`);
    }

    // --- GAMEPLAY API ---

    /**
     * Gọi khi sinh ra các mục tiêu (vd: Gọi từ SpawnTable hoặc SpawnBlock)
     */
    public registerObjectsSpawned(count: number) {
        this._totalObjects += count;
        this._remainingObjects += count;
        //  console.log(`[GameManager] Đã đăng ký mục tiêu. Tổng cộng: ${this._totalObjects}`);
    }

    /**
     * Gọi khi phá hủy thành công một mục tiêu
     */
    public onObjectDestroyed() {
        if (this._currentState !== GameplayState.Playing) return;

        this._remainingObjects--;
        //  console.log(`[GameManager] Phá hủy mục tiêu! Còn lại: ${this._remainingObjects}/${this._totalObjects}`);

        if (this._remainingObjects <= 0) {
            // Kiểm tra còn map tiếp theo không
            if (MapSpawner.instance && MapSpawner.instance.hasNextMap()) {
                this.transitionToNextMap();
            } else {
                this.triggerVictory();
            }
        }
    }

    /**
     * Gọi khi bắn một viên đạn
     */
    public registerBulletFired() {
        if (this._currentState !== GameplayState.Playing) return;

        this._bulletsFired++;
        //   console.log(`[GameManager] Bắn đạn! Còn lại: ${this.remainingBullets}/${this.bulletLimit}`);

        EventManager.instance.emit(GlobalEvent.ON_BULLETS_CHANGED, this.remainingBullets, this.bulletLimit);

        // Hết đạn -> Khóa ngay tương tác chạm màn hình (không cho bắn tiếp)
        if (this.remainingBullets <= 0) {
            InputController.disable();
            //    console.log(`[GameManager] Hết đạn! Đã khóa input của người chơi.`);
        }

        // Hết đạn mà vẫn còn mục tiêu -> Bắt đầu đếm ngược chờ đạn rơi
        if (this._bulletsFired >= this.bulletLimit && this._remainingObjects > 0 && !this._isLoseCountdown) {
            this.startLoseCountdown();
        }
    }

    // --- CHUYỂN MAP ---

    private transitionToNextMap() {
        this.cancelLoseCountdown(); // Hủy countdown lose nếu đang chạy

        // console.log(`[GameManager] Dọn sạch map! Chuyển map tiếp sau ${this.mapTransitionDelay}s...`);

        // Delay ngắn để hiệu ứng vỡ/destroy chạy xong rồi mới chuyển map
        this.scheduleOnce(() => {
            if (!MapSpawner.instance) return;

            const nextIndex = MapSpawner.instance.currentMapIndex + 1;

            // Reset đếm mục tiêu cho map mới
            this._totalObjects = 0;
            this._remainingObjects = 0;

            // Reset đạn cho map mới
            this._bulletsFired = 0;

            // Load map tiếp theo
            MapSpawner.instance.loadMap(nextIndex);

            // Mở lại input khi chuyển sang map mới thành công
            InputController.enable();

            // Phát sự kiện cập nhật lại UI số lượng bóng
            EventManager.instance.emit(GlobalEvent.ON_BULLETS_CHANGED, this.remainingBullets, this.bulletLimit);

            console.log(`[GameManager] Đã chuyển sang Map ${nextIndex}. Đạn reset: ${this.bulletLimit} | Đã mở khóa input.`);
        }, this.mapTransitionDelay);
    }

    // --- XỬ LÝ WIN / LOSE (Điều phối trung tâm) ---

    private startLoseCountdown() {
        this._isLoseCountdown = true;
        console.log(`[GameManager] Hết đạn! Bắt đầu đếm ngược ${this.loseCountdownDuration}s để xác nhận Lose...`);

        // TỐI ƯU PLAYABLE: 
        // Dùng scheduleOnce thay vì hàm update() chạy mỗi frame
        this.scheduleOnce(this.triggerGameOver, this.loseCountdownDuration);
    }

    private cancelLoseCountdown() {
        if (this._isLoseCountdown) {
            this._isLoseCountdown = false;
            this.unschedule(this.triggerGameOver);
            console.log('[GameManager] Đã hủy đếm ngược Lose.');
        }
    }

    public triggerVictory() {
        if (this._currentState === GameplayState.Victory || this._currentState === GameplayState.GameOver) return;

        this.cancelLoseCountdown(); // Chắc chắn hủy hẹn giờ thua nếu vừa vỡ block cuối sát nút
        this._currentState = GameplayState.Victory;

        console.log('[GameManager] Đã dọn sạch mục tiêu -> CHIẾN THẮNG!');

        // Ủy quyền phần hiển thị (VFX, UI Call To Action, Analytics) cho LevelController
        if (LevelController.instance) {
            LevelController.instance.onLevelWin();
        }
    }

    public triggerGameOver() {
        if (this._currentState === GameplayState.Victory || this._currentState === GameplayState.GameOver) return;

        this._currentState = GameplayState.GameOver;
        this._isLoseCountdown = false;

        console.log('[GameManager] Hết giờ chờ đạn rơi, nhưng vẫn còn mục tiêu -> THẤT BẠI!');

        // Ủy quyền phần hiển thị UI cho LevelController
        if (LevelController.instance) {
            LevelController.instance.onLevelLose();
        }
    }
}
