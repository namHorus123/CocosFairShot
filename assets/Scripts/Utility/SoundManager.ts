import { _decorator, Component, AudioSource, AudioClip, Node, CCBoolean } from 'cc';
import Singleton from './Singleton';
import EventManager from './EventManager';
import { GlobalEvent } from './Event/GlobalEvent';
import super_html_playable from './super_html_playable';
const { ccclass, property } = _decorator;

@ccclass('Sound')
export class Sound {
    @property
    public name: string = '';

    @property({ type: AudioClip })
    public clip: AudioClip | null = null;

    @property
    public playOnAwake: boolean = false;

    @property
    public loop: boolean = false;



    @property
    public volume: number = 1;

    public source: AudioSource | null = null;
}

@ccclass('SoundManager')
export class SoundManager extends Singleton<SoundManager> {

    constructor() {
        super();
        SoundManager.instance = this;
    }
    @property([Sound])
    private listSounds: Sound[] = [];

    @property(AudioSource)
    private theme: AudioSource = null;

    // @property(AudioSource)
    // listAudio: AudioSource[] = [];

    @property(CCBoolean)
    activeSound: boolean = false;

    @property
    isPlaySoundBG: boolean = false;
    protected onLoad() {
        // this.listAudio.push(this.theme);
        this.initializeSounds();

        EventManager.instance.on(GlobalEvent.SHOW_LOSE, this.stopAllTheme, this);
        EventManager.instance.on(GlobalEvent.SHOW_WIN, this.stopAllTheme, this);

    }

    protected onDisable(): void {
        EventManager.instance.off(GlobalEvent.SHOW_LOSE, this.stopAllTheme, this);
        EventManager.instance.off(GlobalEvent.SHOW_WIN, this.stopAllTheme, this);
    }

    // protected update(dt: number): void {
    //     // Đồng bộ volume với super_html.is_audio() từ MRAID audioVolumeChange event
    //     const isAudioEnabled = super_html_playable.is_audio();

    //     // Cập nhật volume cho theme
    //     if (this.theme) {
    //         if (isAudioEnabled && this.isPlaySoundBG) {
    //             // Giữ volume theme ở mức 0.4 khi audio được bật
    //             this.theme.volume = 0.6;
    //         } else {
    //             // Tắt volume khi audio bị tắt
    //             this.theme.volume = 0;
    //         }
    //     }

    //     // Cập nhật volume cho tất cả sounds
    //     this.listSounds.forEach(sound => {
    //         if (sound.source) {
    //             if (isAudioEnabled) {
    //                 // Bật audio và set volume về giá trị ban đầu
    //                 sound.source.enabled = true;
    //                 sound.source.volume = sound.volume;
    //             } else {
    //                 // Tắt audio khi bị mute
    //                 sound.source.enabled = false;
    //                 sound.source.volume = 0;
    //             }
    //         }
    //     });
    // }


    private initializeSounds() {
        this.listSounds.forEach(sound => {
            sound.source = this.node.addComponent(AudioSource);
            //  this.listAudio.push(sound.source);
            if (sound.clip) {
                sound.source.playOnAwake = false;
                sound.source.clip = sound.clip;
                sound.source.volume = 0;
                sound.source.loop = sound.loop;

                // if (sound.playOnAwake) {
                //     this.playSound(sound.name);
                // }
            }
        });
    }

    public playSound(name: string) {
        // Chỉ phát âm thanh nếu audio được bật
        if (!super_html_playable.is_audio()) {
            return;
        }
        const sound = this.listSounds.find(s => s.name === name);
        if (sound && sound.source) {
            sound.source.volume = sound.volume;
            sound.source.playOneShot(sound.clip, sound.volume);
        }
    }

    public stop(name: string) {
        const sound = this.listSounds.find(s => s.name === name);
        if (sound && sound.source) {
            sound.source.stop();
        }
    }

    public playTheme() {
        // Chỉ phát theme nếu audio được bật
        if (!super_html_playable.is_audio()) {
            return;
        }
        if (this.theme && !this.isPlaySoundBG) {
            this.isPlaySoundBG = true;
            this.theme.volume = 0.4;
            this.theme.play();
        }
    }
    public stopAllTheme() {
        // this.theme.volume = 0;
    }

    public changeVolume(volume: number) {
        this.listSounds.forEach(sound => {
            if (sound.source) {
                sound.source.volume = volume;
                if (volume === 0) {
                    sound.source.enabled = false;
                } else {
                    sound.source.enabled = true;
                }
            }
        });
    }
}