import Singleton from "../Singleton";
import BasePool from "./BasePool";
import { _decorator, Component, Enum, Node } from "cc";
const { ccclass, property } = _decorator;
export enum TypeNodePool {
   NONE,
   PROJECTILE,
   BLOCK,
   PIXEL,
   EFFECT
}
@ccclass('BasePoolInfo')
export class BasePoolInfo {
    @property({ type: Enum(TypeNodePool) })
    public typeNodePool: TypeNodePool = TypeNodePool.NONE;
    @property(BasePool)
    public basePool: BasePool = null;
}
@ccclass
export default class PoolManager extends Singleton<PoolManager> {
   

    constructor() {
        super();
        PoolManager.instance = this;
    }

    @property([BasePoolInfo])
    public poolArrays: BasePoolInfo[] = [];

    onLoad() {
        super.onLoad?.();
    }
   

    /** Trả về parentNode của pool theo type (để projectile/node reparent về đây trước khi trả pool, tránh bị destroy theo node khác). */
    getParentNodeForPool(type: TypeNodePool): Node | null {
        for (let i = 0; i < this.poolArrays.length; i++) {
            if (type === this.poolArrays[i].typeNodePool) {
                const pool = this.poolArrays[i].basePool;
                return pool?.parentNode ?? null;
            }
        }
        return null;
    }

    PutNodeToPool(type: TypeNodePool, node: Node) {
        if (!node) return;
        for (let i = 0; i < this.poolArrays.length; i++) {
            if (type == this.poolArrays[i].typeNodePool) {
                this.poolArrays[i].basePool.PutObject(node);
            }
        }
    }
    GetNodeOfPool(type: TypeNodePool): Node {
        let nodeReturn = null;
        for (let i = 0; i < this.poolArrays.length; i++) {
            if (type == this.poolArrays[i].typeNodePool) {
                nodeReturn = this.poolArrays[i].basePool.GetObject();
            }
        }
        try {
            if (!nodeReturn) throw new Error("Pool of this type is null");
            return nodeReturn;
        }
        catch (error) {
            console.error("Error: ", error);
            return null;
        }
    }
}