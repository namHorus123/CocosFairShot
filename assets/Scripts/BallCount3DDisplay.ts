import { _decorator, Component, Label } from 'cc';
import { GameManager } from './manager/GameManager';
import EventManager from './Utility/EventManager';
import { GlobalEvent } from './Utility/Event/GlobalEvent';

const { ccclass, property } = _decorator;

@ccclass('BallCount3DDisplay')
export class BallCount3DDisplay extends Component {
    @property({ type: Label, tooltip: 'Component Label để hiển thị text' })
    public textLabel: Label | null = null;

    protected onEnable() {
        EventManager.instance.on(GlobalEvent.ON_BULLETS_CHANGED, this.handleBulletsChanged, this);

        // Cập nhật giá trị ban đầu nếu GameManager đã sẵn sàng
        if (GameManager.instance) {
            this.updateDisplay(GameManager.instance.remainingBullets);
        }
    }

    protected onDisable() {
        EventManager.instance.off(GlobalEvent.ON_BULLETS_CHANGED, this.handleBulletsChanged, this);
    }

    private handleBulletsChanged(remaining: number, total: number) {
        this.updateDisplay(remaining);
    }

    public updateDisplay(remaining: number) {
        if (this.textLabel) {
            this.textLabel.string = remaining.toString();
        }
    }
}
