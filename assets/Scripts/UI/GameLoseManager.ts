import { _decorator, Animation, Component, easing, Node, tween, UIOpacity, Vec3 } from 'cc';
import { SoundManager } from '../Utility/SoundManager';
import Global from '../Utility/Global';
import { GlobalEvent } from '../Utility/Event/GlobalEvent';
import EventManager from '../Utility/EventManager';
const { ccclass, property } = _decorator;

@ccclass('GameLoseManager')
export class GameLoseManager extends Component {
    @property(Node)
    content: Node = null;
    @property(Node)
    failed: Node = null;
    @property(Node)
    icon: Node = null;
    @property(Node)
    playNow: Node = null;

    protected onLoad(): void {
        this.content.active = false;
    }

    protected onEnable(): void {
        EventManager.instance.on(GlobalEvent.SHOW_LOSE, this.show, this)
    }
    protected onDisable(): void {

        EventManager.instance.off(GlobalEvent.SHOW_LOSE, this.show, this)
    }
    show() {
        if (Global.video) return;


        if (Global.endGame) return;
        Global.endGame = true;
        if (this.content.active) return;


        console.log("show lose");
        SoundManager.Instance(SoundManager).playSound("BGM_Fail");

        this.icon.active = false;
        this.icon.setScale(Vec3.ZERO)
        this.content.active = true;
        this.failed.setScale(new Vec3(0.4, 0.4, 0.4))

        this.playNow.active = false;
        this.playNow.setScale(Vec3.ZERO)
        tween(this.failed)
            .to(0.4, { scale: new Vec3(0.6, 0.6, 0.6) }, { easing: this.backOut })
            .delay(1)
            .call(() => {
                this.showIcon()
            })
            .start();
    }
    backOut(k: number) {
        if (k === 0) {
            return 0;
        }
        const s = 3.5;
        return --k * k * ((s + 1) * k + s) + 1;
    }
    showIcon() {

        let uiOpactityFailed: UIOpacity = this.failed.getComponent(UIOpacity);
        this.icon.active = true;
        this.icon.setScale(Vec3.ZERO)

        this.playNow.active = true;


        tween(this.icon)
            .to(0.4, { scale: new Vec3(0.8, 0.8, 0.8) }, { easing: this.backOut })
            .start();

        tween(this.playNow)
            .to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: this.backOut })
            .call(() => {
                this.playNow.getComponent(Animation).play("Pulse_UI");
            })
            .start();

        tween(uiOpactityFailed)
            .to(0.4, { opacity: 0 },)
            .start();

        tween(this.failed)
            .to(0.4, { scale: Vec3.ZERO })
            .start();

        this.scheduleOnce(() => {
            GlobalEvent.instance().dispatchEvent(GlobalEvent.ACTIVE_AUTO_OPEN_STORE);
        }, 1);
    }
}


