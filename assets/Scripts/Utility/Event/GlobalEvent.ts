import { _decorator } from 'cc';
import BaseEvent from './BaseEvent';
const { ccclass, property } = _decorator;

@ccclass('GlobalEvent')
export class GlobalEvent extends BaseEvent {
    private static event: GlobalEvent | null = null;
    private constructor() {
        super();
    }

    public static instance(): GlobalEvent {
        if (!GlobalEvent.event) {
            GlobalEvent.event = new GlobalEvent();
        }
        return GlobalEvent.event;
    }

    // Các chuỗi sự kiện
    static readonly START_GAME = "GlobalEvent.START_GAME";
    static readonly ON_BULLETS_CHANGED = "GlobalEvent.ON_BULLETS_CHANGED";
    static readonly SHOW_LOSE = "GlobalEvent.SHOW_LOSE";
    static readonly SHOW_WIN = "GlobalEvent.SHOW_WIN";
    static readonly OPEN_STORE = "GlobalEvent.OPEN_STORE";
    static readonly ACTIVE_AUTO_OPEN_STORE = "GlobalEvent.ACTIVE_AUTO_OPEN_STORE";
    static readonly CHECK_PLAYABLE = "GlobalEvent.CHECK_PLAYABLE";
    static readonly SHOW_TUTORIAL = "GlobalEvent.SHOW_TUTORIAL";
    static readonly CLEAR_TUTORIAL = "GlobalEvent.CLEAR_TUTORIAL";
    static readonly END_GAME = "GlobalEvent.END_GAME";
    static readonly SHOW_BTN_ALL = "GlobalEvent.SHOW_BTN_ALL";

    static readonly CHECK_END_GAME = "GlobalEvent.CHECK_END_GAME";

    static readonly CLEAR_TUTORIAL_INTRO = "GlobalEvent.CLEAR_TUTORIAL_INTRO";
    static readonly GAME_RESIZE = "GlobalEvent.GAME_RESIZE";
    static readonly CHECK_HAS_BLOCK_STANDING_ON = "GlobalEvent.CHECK_HAS_BLOCK_STANDING_ON";
    static readonly RESET_BLOCK_MAP = "GlobalEvent.RESET_BLOCK_MAP";
    static readonly CLICK_OPEN_STORE = "GlobalEvent.CLICK_OPEN_STORE";
    static readonly AUTO_RELEASE = "GlobalEvent.AUTO_RELEASE";

    static readonly SHOW_WARNING = "GlobalEvent.SHOW_WARNING";
    static readonly HANDLE_GUIDE = "GlobalEvent.HANDLE_GUIDE";
    static readonly ACTIVE_GUIDE = "GlobalEvent.ACTIVE_GUIDE";
    static readonly DISABLE_GUIDE = "GlobalEvent.DISABLE_GUIDE";
    static readonly CARD_DIE = "GlobalEvent.CARD_DIE";
    static readonly ALL_ENEMIES_DIED = "GlobalEvent.ALL_ENEMIES_DIED";
    static readonly SHOW_CHOOSE_MANAGER = "GlobalEvent.SHOW_CHOOSE_MANAGER";
    static readonly CHOOSE_COMPLETE = "GlobalEvent.CHOOSE_COMPLETE";
    static readonly COMBAT_ROUND_COMPLETE = "GlobalEvent.COMBAT_ROUND_COMPLETE";
    static readonly COMBAT_ROUND_3_READY = "GlobalEvent.COMBAT_ROUND_3_READY";
    static readonly ALLY_SELECTED = "GlobalEvent.ALLY_SELECTED";
    static readonly ENEMY_SELECTED = "GlobalEvent.ENEMY_SELECTED";

    static PICK_UNIT: string = "GlobalEvent.PICK_UNIT";

}
