import { _decorator, Animation, Component, Node, tween, Vec3 } from 'cc';
import { GlobalEvent } from '../Utility/Event/GlobalEvent';
import Global from '../Utility/Global';
import EventManager from '../Utility/EventManager';
import { SoundManager } from '../Utility/SoundManager';
const { ccclass, property } = _decorator;

@ccclass('GameWinManager')
export class GameWinManager extends Component {
    @property(Node)
    content: Node = null;

    // @property(Node)
    // icon: Node = null;

    @property(Node)
    playNow: Node = null;

    @property(Node)
    portrait: Node = null;

    @property(Node)
    landscape: Node = null;

    protected onLoad(): void {
        this.content.active = false;
    }

    protected onEnable(): void {
        EventManager.instance.on(GlobalEvent.SHOW_WIN, this.show, this)
    }
    protected onDisable(): void {

        EventManager.instance.off(GlobalEvent.SHOW_WIN, this.show, this)
    }
    show() {
        if (Global.video) return;

        // if (Global.endGame) return;
        // Global.endGame = true;
        if (this.content.active) return;
        // GlobalEvent.instance().dispatchEvent(GlobalEvent.ACTIVE_AUTO_OPEN_STORE);
        SoundManager.Instance(SoundManager).playSound("BGM_Win");

        this.content.active = true;
        this.portrait.active = false;
        this.playNow.active = false;
        this.playNow.setScale(Vec3.ZERO)
        tween(this.node)
            .delay(0.25)
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

        // this.icon.active = true;
        // this.icon.setScale(Vec3.ZERO)

        this.playNow.active = true;


        // tween(this.icon)
        //     .to(0.4, { scale: new Vec3(0.8, 0.8, 0.8) }, { easing: this.backOut })
        //     .start();

        tween(this.playNow)
            .to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: this.backOut })
            .call(() => {
                this.playNow.getComponent(Animation).play("Pulse_UI");
            })
            .start();

    }
}


