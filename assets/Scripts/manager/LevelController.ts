import { _decorator, Component, Node, ParticleSystem, tween, Vec3 } from 'cc';
import { InputController } from './InputController';
import EventManager from '../Utility/EventManager';
import { GlobalEvent } from '../Utility/Event/GlobalEvent';

const { ccclass, property } = _decorator;

@ccclass('LevelController')
export class LevelController extends Component {

    public static instance: LevelController | null = null;

    // --- CẤU HÌNH PLAYABLE ---

    @property({ type: [ParticleSystem], tooltip: 'Danh sách Particle System pháo hoa khi thắng' })
    public vfxFireworks: ParticleSystem[] = [];

    @property({ tooltip: 'Độ trễ trước khi hiện màn hình EndGame và phát sự kiện SHOW_WIN (giây)' })
    public delayBeforeShowWinLayer: number = 1.0;

    @property({ type: Node, tooltip: 'Node giao diện EndGame (Call To Action) hiện lên cuối game' })
    public endGameLayer: Node | null = null;

    private _isGameEnded: boolean = false;

    onLoad() {
        LevelController.instance = this;

        // Đảm bảo ẩn EndGame CTA lúc mới vào game
        if (this.endGameLayer) {
            this.endGameLayer.active = false;
        }
    }

    start() {
        this.startGamePlay();
    }

    /**
     * Bắt đầu luồng Playable
     */
    private startGamePlay() {
        console.log('[LevelController] Playable Game Started!');

        InputController.disable(); // Khóa input lúc chuyển cảnh/intro

        // Tối ưu Playable: Bật input sau 1 khoảng trễ ngắn (thay thế cho CancellationToken phức tạp)
        this.scheduleOnce(() => {
            InputController.enable();
            console.log('[LevelController] Input Enabled. Người chơi có thể tương tác.');
        }, 1.25); // Bạn có thể chỉnh sửa delay này

        // TODO: Phát nhạc nền nếu có
        // SoundManager.playBGM();
    }

    // --- LUỒNG THẮNG / THUA ---

    public onLevelWin() {
        if (this._isGameEnded) return;
        this._isGameEnded = true;
        console.log('[LevelController] Player Win!');
        InputController.disable(); // Khóa tương tác khi game kết thúc

        // Chạy pháo hoa
        this.playFireworkVFX();

        // Đợi 1 khoảng trễ rồi hiện EndGame (Call To Action) và phát sự kiện SHOW_WIN
        this.scheduleOnce(() => {
            EventManager.instance.emit(GlobalEvent.SHOW_WIN);
            this.showEndGame(true);
        }, this.delayBeforeShowWinLayer);
    }

    public onLevelLose() {
        if (this._isGameEnded) return;
        this._isGameEnded = true;
        EventManager.instance.emit(GlobalEvent.SHOW_LOSE);
        console.log('[LevelController] Player Lose!');
        InputController.disable(); // Khóa tương tác

        this.showEndGame(false);
    }

    /**
     * Hiển thị màn hình Call To Action (CTA)
     */
    private showEndGame(isWin: boolean) {
        if (this.endGameLayer) {
            this.endGameLayer.active = true;

            // Animation hiện popup (Pop-up nảy lên)
            this.endGameLayer.setScale(Vec3.ZERO);
            tween(this.endGameLayer)
                .to(0.5, { scale: Vec3.ONE }, { easing: 'backOut' })
                .start();
        }

        // TỐI ƯU PLAYABLE: Thay vì tracking Firebase phức tạp nặng nề, ta dùng Tracking Log tiêu chuẩn của mạng quảng cáo
        if (isWin) {
            console.log('[Playable Analytics] Trigger: Level Win');
        } else {
            console.log('[Playable Analytics] Trigger: Level Lose');
        }

        // Khi user bấm vào nút Tải Game trên EndGame Layer, nhớ gọi hàm:
        // window.open("link-store-cua-ban"); hoặc dùng sdk mạng quảng cáo: mraid.open()
    }

    // --- HIỆU ỨNG ---

    private playFireworkVFX() {
        if (this.vfxFireworks.length === 0) return;

        for (let i = 0; i < this.vfxFireworks.length; i++) {
            const vfx = this.vfxFireworks[i];
            if (vfx) {
                vfx.node.active = true;
                vfx.play();
            }
        }

        // TODO: Chạy âm thanh pháo hoa
        // SoundManager.playSound('Firework');
    }
}
