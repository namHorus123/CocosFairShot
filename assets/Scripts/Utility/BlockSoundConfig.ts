export class BlockSoundConfig {
    private static readonly BREAK_SOUND_MAP: Record<string, string> = {
        'Ice': 'SFX_Break_IceCube',
        'Metal': 'SFX_Break_Can',
        'Stone': 'SFX_Break_Stone',
        'Jar': 'SFX_Break_Jar',
    };

    private static readonly IMPACT_SOUND_MAP: Record<string, string> = {
        'Ice': 'SFX_impact_IceCube',
        'Metal': 'SFX_Impact_MetalCan',
        'Jar': 'SFX_Break_Jar',
    };

    private static readonly DEFAULT_BREAK_SOUND: string = 'SFX_Break_Default';
    private static readonly DEFAULT_IMPACT_SOUND: string = 'SFX_impact_Default';

    /**
     * Lấy tên sound khi block bị vỡ
     */
    public static getBreakSound(objectId: string): string {
        return this.BREAK_SOUND_MAP[objectId] || this.DEFAULT_BREAK_SOUND;
    }

    /**
     * Lấy tên sound khi đạn bắn trúng block
     */
    public static getImpactSound(objectId: string): string {
        return this.IMPACT_SOUND_MAP[objectId] || this.DEFAULT_IMPACT_SOUND;
    }
}
