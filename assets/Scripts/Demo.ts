import { _decorator, Component, Node, tween, Vec3, NodePool, Tween, Sprite, Color } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('Demo')
export default class Demo extends Component {

    @property([Node])
    nodeDemos: Node[] = [];

    @property(Node)
    demoPos: Node | null = null;

    @property(Node)
    icon: Node | null = null;

    @property
    timeMove: number = 1.0;

    @property
    delayTime: number = 0.3;

    private stepIndex: number = 0;
    private isPlaying: boolean = false;

    start() {
        if (this.icon) {
            this.icon.setScale(Vec3.ZERO);
        }
        if (this.nodeDemos && this.nodeDemos.length > 0) {
            for (let i = 0; i < this.nodeDemos.length; i++) {
                const node = this.nodeDemos[i];
                node.setPosition(new Vec3(1000, 0, 0));
            }
            this.show();
        }
    }

    show() {
        if (this.icon) {
            Tween.stopAllByTarget(this.icon);
            tween(this.icon)
                .to(0.5, { scale: new Vec3(3, 3, 3) }, { easing: 'backOut' })
                .start();
        }
        if (this.demoPos) {
            this.stepIndex = 0;
            this.isPlaying = true;
            this.runStep();
        }
    }

    runStep() {
        if (!this.isPlaying) return;

        const N = this.stepIndex;

        // 1. Calculate target slots for all cards
        const targetSlots = this.nodeDemos.map((_, i) => {
            const K = N - i;
            return K < 0 ? -1 : (K % 4);
        });

        // 2. Sort nodes by target slot depth to assign sibling index correctly
        const getSlotDepth = (slot: number) => {
            if (slot === -1) return 0;
            if (slot === 2) return 1; // Back
            if (slot === 3) return 2; // Right
            if (slot === 1) return 3; // Left
            if (slot === 0) return 4; // Front
            return 0;
        };

        const sortedIndices = this.nodeDemos
            .map((node, index) => ({ node, index }))
            .sort((a, b) => getSlotDepth(targetSlots[a.index]) - getSlotDepth(targetSlots[b.index]));

        sortedIndices.forEach((item, order) => {
            item.node.setSiblingIndex(order);
        });

        // 3. Tween each card to its target position and scale
        let completedTweens = 0;
        const totalCards = this.nodeDemos.length;

        const checkNextStep = () => {
            completedTweens++;
            if (completedTweens === totalCards) {
                this.scheduleOnce(() => {
                    this.stepIndex++;
                    this.runStep();
                }, this.delayTime);
            }
        };

        for (let i = 0; i < totalCards; i++) {
            const node = this.nodeDemos[i];
            const slot = targetSlots[i];
            const targetPos = this.getSlotPosition(slot);
            const targetScale = this.getSlotScale(slot);

            const sprite = node.getComponent(Sprite);
            const targetAlpha = slot === 0 ? 255 : (slot === -1 ? 0 : 0);

            Tween.stopAllByTarget(node);
            if (sprite) {
                Tween.stopAllByTarget(sprite);
            }

            // If it's already offscreen and stays offscreen, skip tween
            if (node.position.x > 999 && targetPos.x > 999) {
                node.setPosition(targetPos);
                node.setScale(targetScale);
                if (sprite) {
                    const curColor = sprite.color.clone();
                    curColor.a = targetAlpha;
                    sprite.color = curColor;
                }
                checkNextStep();
            } else {
                tween(node)
                    .to(this.timeMove, { position: targetPos, scale: targetScale }, { easing: 'sineOut' })
                    .call(checkNextStep)
                    .start();

                if (sprite) {
                    const curColor = sprite.color.clone();
                    curColor.a = targetAlpha;
                    tween(sprite)
                        .to(this.timeMove, { color: curColor }, { easing: 'sineOut' })
                        .start();
                }
            }
        }
    }

    getSlotPosition(slot: number): Vec3 {
        if (slot === -1) {
            return new Vec3(1000, 0, 0); // Offscreen
        }
        // Slot mappings: 0 -> children[2], 1 -> children[0], 2 -> children[3], 3 -> children[1]
        const map = [2, 0, 3, 1];
        const childIndex = map[slot];
        return this.demoPos!.children[childIndex].position;
    }

    getSlotScale(slot: number): Vec3 {
        if (slot === 0) {
            return new Vec3(1.2, 1.2, 1.2);
        }
        return Vec3.ONE;
    }

    onDestroy() {
        this.isPlaying = false;
        this.unscheduleAllCallbacks();
        if (this.icon) {
            Tween.stopAllByTarget(this.icon);
        }
        for (const node of this.nodeDemos) {
            Tween.stopAllByTarget(node);
            const sprite = node.getComponent(Sprite);
            if (sprite) {
                Tween.stopAllByTarget(sprite);
            }
        }
    }
}
