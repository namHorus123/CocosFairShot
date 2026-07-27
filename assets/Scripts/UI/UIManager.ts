import { _decorator, Animation, Component, Node, input, Input } from 'cc';
import { GameWinManager } from './GameWinManager';
import { GlobalEvent } from '../Utility/Event/GlobalEvent';
import EventManager from '../Utility/EventManager';
import Global from '../Utility/Global';
import { SoundManager } from '../Utility/SoundManager';
const { ccclass, property } = _decorator;

@ccclass('UIManager')
export class UIManager extends Component {

    @property(Node)
    guide: Node = null;

    @property(Node)
    winUI: Node = null;

    @property(GameWinManager)
    win: GameWinManager = null;

    @property(Node)
    btnAll: Node = null;

    protected onLoad(): void {
        EventManager.instance.on(GlobalEvent.START_GAME, this.disableGuide, this);

        EventManager.instance.on(GlobalEvent.SHOW_WIN, this.showWin, this);
        EventManager.instance.on(GlobalEvent.SHOW_WIN, this.activeBtnAll, this);

        EventManager.instance.on(GlobalEvent.SHOW_LOSE, this.activeBtnAll, this);

        EventManager.instance.on(GlobalEvent.SHOW_TUTORIAL, this.activeGuide, this);
        EventManager.instance.on(GlobalEvent.SHOW_BTN_ALL, this.activeBtnAll, this);

        input.on(Input.EventType.TOUCH_START, this.onFirstTouch, this);
    }

    protected onDisable(): void {
        EventManager.instance.off(GlobalEvent.START_GAME, this.disableGuide, this);

        EventManager.instance.off(GlobalEvent.SHOW_WIN, this.showWin, this);
        EventManager.instance.off(GlobalEvent.SHOW_WIN, this.activeBtnAll, this);

        EventManager.instance.off(GlobalEvent.SHOW_LOSE, this.activeBtnAll, this);

        EventManager.instance.off(GlobalEvent.SHOW_TUTORIAL, this.activeGuide, this);
        EventManager.instance.off(GlobalEvent.SHOW_BTN_ALL, this.activeBtnAll, this);

        input.off(Input.EventType.TOUCH_START, this.onFirstTouch, this);
    }

    protected start(): void {
        if (Global.video) {
            this.guide.active = false;
            return;
        }
    }

    private onFirstTouch(): void {
        this.disableGuide();
        EventManager.instance.emit(GlobalEvent.START_GAME);
        input.off(Input.EventType.TOUCH_START, this.onFirstTouch, this);
    }

    disableGuide() {
        this.guide.active = false;
    }

    activeGuide() {
        if (Global.video) { return; }
        this.guide.active = true;
        //  this.guide.getComponent(Animation).play("Guide");

        // Re-register to turn off the guide when the player touches next time
        input.off(Input.EventType.TOUCH_START, this.onFirstTouch, this);
        input.on(Input.EventType.TOUCH_START, this.onFirstTouch, this);
    }

    showWin() {
        if (Global.video) { return; }

        // if (this.winUI.activeInHierarchy) return;

        // SoundManager.Instance(SoundManager).playSound("Win");

        // this.winUI.active = true;
        // this.scheduleOnce(() => {
        //     this.win.show();
        // }, 1.5)

    }
    activeBtnAll() {
        this.btnAll.active = true;
    }



}


