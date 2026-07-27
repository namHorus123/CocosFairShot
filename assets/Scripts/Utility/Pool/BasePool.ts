import { _decorator, CCBoolean, CCInteger, instantiate, Node, NodePool, Prefab } from "cc";

const { ccclass, property } = _decorator;

@ccclass("BasePool")
export default class BasePool {
    private pool: NodePool;
    @property(Prefab)
    private Prefab: Prefab = null;
    @property(CCBoolean)
    public reuse: boolean = true;


    @property(Node)
    public parentNode: Node = null;
    @property(CCInteger)
    public Size: number = 0;

    constructor() {
        this.pool = new NodePool();
        //Khong can biet chinh xac so luong nut ban dau ta se sinh ra cac nut neu bi thieu trong thoi gian chay
        // for (let i = 0; i < this.Size; ++i) {
        //     let obj = cc.instantiate(this.Prefab); // create node instance
        //     this.pool.put(obj); // populate your pool with put method
        // }
    }
    GetObject(): Node {
        if (this.reuse) {
            let obj: Node = null;
            if (this.pool.size() > 0) {
                obj = this.pool.get();
                obj.active = true;
            } else {
                obj = instantiate(this.Prefab);
            }
            if (this.parentNode) {
                obj.setParent(this.parentNode);
            }
            return obj;
        } else {
            let obj: Node = instantiate(this.Prefab);
            if (this.parentNode) {
                obj.setParent(this.parentNode);
            }
            return obj;
        }
    }
    PutObject(obj: Node) {
        if (this.reuse) {
            // Reparent về parentNode trước để node không bị destroy theo parent cũ (vd. pixel).
            if (this.parentNode && this.parentNode.isValid && obj.isValid) {
                obj.setParent(this.parentNode);
            }
            obj.active = false;
            this.pool.put(obj);
        } else {
            obj.destroy();
        }
    }
    ClearPool() {
        this.pool.clear();
    }

}