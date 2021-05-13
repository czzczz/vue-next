import { isObject, toRawType, def } from '@vue/shared'
import {
  mutableHandlers,
  readonlyHandlers,
  shallowReactiveHandlers,
  shallowReadonlyHandlers
} from './baseHandlers'
import {
  mutableCollectionHandlers,
  readonlyCollectionHandlers,
  shallowCollectionHandlers,
  shallowReadonlyCollectionHandlers
} from './collectionHandlers'
import { UnwrapRef, Ref } from './ref'

export const enum ReactiveFlags {
  /**
   * Target对象的标记，表明该对象跳过代理转换
   */
  SKIP = '__v_skip',
  /**
   * Target对象的标记，表明该对象已经转为reactive响应式对象
   */
  IS_REACTIVE = '__v_isReactive',
  /**
   * Target对象的标记，表明该对象已经转为readonly只读对象
   */
  IS_READONLY = '__v_isReadonly',
  RAW = '__v_raw'
}

export interface Target {
  [ReactiveFlags.SKIP]?: boolean
  [ReactiveFlags.IS_REACTIVE]?: boolean
  [ReactiveFlags.IS_READONLY]?: boolean
  [ReactiveFlags.RAW]?: any
}

/**
 * 全局的响应式对象弱引用映射表，记录已经建立响应式监听的对象引用
 */
export const reactiveMap = new WeakMap<Target, any>()
/**
 * 全局的浅代理响应式对象弱引用映射表，记录已经建立浅代理响应式监听的对象引用
 */
export const shallowReactiveMap = new WeakMap<Target, any>()
/**
 * 全局的只读对象弱引用映射表，记录已经建立只读代理的对象引用
 */
export const readonlyMap = new WeakMap<Target, any>()
/**
 * 全局的浅代理只读对象弱引用映射表，记录已经建立浅代理只读的对象引用
 */
export const shallowReadonlyMap = new WeakMap<Target, any>()

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
  COLLECTION = 2
}

/**
 * 映射变量类型及建立响应式时该类型的分类，包括
 *
 * TargetType.COMMON：通常对象，Array
 *
 * TargetType.COLLECTION：集合（Set、Map）
 *
 * TargetType.INVALID：其他，不可建立响应式监听
 *
 * @function targetTypeMap
 * @author czzczz
 * @param {string} rawType 类型字符串
 * @returns {TargetType} 结果
 */
function targetTypeMap(rawType: string) {
  switch (rawType) {
    case 'Object':
    case 'Array':
      return TargetType.COMMON
    case 'Map':
    case 'Set':
    case 'WeakMap':
    case 'WeakSet':
      return TargetType.COLLECTION
    default:
      return TargetType.INVALID
  }
}

/**
 * 获取Target的具体分类
 *
 * @function getTargetType
 * @param {Target} value 目标值
 * @returns {TargetType} 具体分类
 */
function getTargetType(value: Target) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : targetTypeMap(toRawType(value))
}

// only unwrap nested ref
export type UnwrapNestedRefs<T> = T extends Ref ? T : UnwrapRef<T>

/**
 * Creates a reactive copy of the original object.
 *
 * The reactive conversion is "deep"—it affects all nested properties. In the
 * ES2015 Proxy based implementation, the returned proxy is **not** equal to the
 * original object. It is recommended to work exclusively with the reactive
 * proxy and avoid relying on the original object.
 *
 * A reactive object also automatically unwraps refs contained in it, so you
 * don't need to use `.value` when accessing and mutating their value:
 *
 * ```js
 * const count = ref(0)
 * const obj = reactive({
 *   count
 * })
 *
 * obj.count++
 * obj.count // -> 1
 * count.value // -> 1
 * ```
 */
export function reactive<T extends object>(target: T): UnwrapNestedRefs<T>

/**
 * 为一个引用型变量进行递归的代理
 *
 * @function reactive
 * @author czzczz
 * @param {object} target 目标引用值
 * @returns {UnwrapNestedRefs} 代理对象的引用
 */
export function reactive(target: object) {
  // if trying to observe a readonly proxy, return the readonly version.
  // 之前已经通过readonly等手段将该引用对象转为了只读的代理对象，则直接返回只读版不建立响应式
  if (target && (target as Target)[ReactiveFlags.IS_READONLY]) {
    return target
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  )
}

/**
 * Return a shallowly-reactive copy of the original object, where only the root
 * level properties are reactive. It also does not auto-unwrap refs (even at the
 * root level).
 */
export function shallowReactive<T extends object>(target: T): T {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  )
}

type Primitive = string | number | boolean | bigint | symbol | undefined | null
type Builtin = Primitive | Function | Date | Error | RegExp
export type DeepReadonly<T> = T extends Builtin
  ? T
  : T extends Map<infer K, infer V>
    ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
    : T extends ReadonlyMap<infer K, infer V>
      ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>
      : T extends WeakMap<infer K, infer V>
        ? WeakMap<DeepReadonly<K>, DeepReadonly<V>>
        : T extends Set<infer U>
          ? ReadonlySet<DeepReadonly<U>>
          : T extends ReadonlySet<infer U>
            ? ReadonlySet<DeepReadonly<U>>
            : T extends WeakSet<infer U>
              ? WeakSet<DeepReadonly<U>>
              : T extends Promise<infer U>
                ? Promise<DeepReadonly<U>>
                : T extends {}
                  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
                  : Readonly<T>

/**
 * Creates a readonly copy of the original object. Note the returned copy is not
 * made reactive, but `readonly` can be called on an already reactive object.
 */
export function readonly<T extends object>(
  target: T
): DeepReadonly<UnwrapNestedRefs<T>> {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  )
}

/**
 * Returns a reactive-copy of the original object, where only the root level
 * properties are readonly, and does NOT unwrap refs nor recursively convert
 * returned properties.
 * This is used for creating the props proxy object for stateful components.
 */
export function shallowReadonly<T extends object>(
  target: T
): Readonly<{ [K in keyof T]: UnwrapNestedRefs<T[K]> }> {
  return createReactiveObject(
    target,
    true,
    shallowReadonlyHandlers,
    shallowReadonlyCollectionHandlers,
    shallowReadonlyMap
  )
}

/**
 * 创建响应式对象
 *
 * @function createReactiveObject
 * @author czzczz
 * @param {Target} target 目标引用
 * @param {boolean} isReadonly 是否为只读
 * @param {ProxyHandler<any>} baseHandlers Proxy代理的处理器
 * @param {ProxyHandler<any>} collectionHandlers 集合型对象（Set、Map）的处理器
 * @param {WeakMap<Target, any>} proxyMap 全局的弱引用代理集合，记录已经代理的对象，见reactiveMap，shallowReactiveMap，readonlyMap，shallowReadonlyMap
 * @returns {any} 创建结果
 */
function createReactiveObject(
  target: Target,
  isReadonly: boolean,
  baseHandlers: ProxyHandler<any>,
  collectionHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<Target, any>
) {
  // reactive因为要通过Proxy建立代理，只接受引用型变量
  if (!isObject(target)) {
    if (__DEV__) {
      console.warn(`value cannot be made reactive: ${String(target)}`)
    }
    return target
  }
  // target is already a Proxy, return it.
  // exception: calling readonly() on a reactive object
  // 已经是响应式对象，不可转为 readonly，直接返回
  if (
    target[ReactiveFlags.RAW] &&
    !(isReadonly && target[ReactiveFlags.IS_REACTIVE])
  ) {
    return target
  }
  // target already has corresponding Proxy
  // 已经对该对象建立了相应类型的代理，直接返回，这部分即处理了target内部的循环引用
  const existingProxy = proxyMap.get(target)
  if (existingProxy) {
    return existingProxy
  }
  // only a whitelist of value types can be observed.
  // 类型为TargetType.INVALID 不可建立代理，直接返回
  const targetType = getTargetType(target)
  if (targetType === TargetType.INVALID) {
    return target
  }
  // 对（Set、Map、WeakSet、WeakMap）使用集合类的处理器，其他使用一般处理器
  const proxy = new Proxy(
    target,
    targetType === TargetType.COLLECTION ? collectionHandlers : baseHandlers
  )
  // 记录已经建立代理的对象及代理结果
  proxyMap.set(target, proxy)
  return proxy
}

/**
 * 判断目标对象是否已建立响应式代理
 *
 * 若目标值本身是只读的，判断其 ReactiveFlags.RAW 是否为响应式
 *
 * @function isReactive
 * @param {unknown} value 目标值
 * @returns {boolean} 结果
 */
export function isReactive(value: unknown): boolean {
  if (isReadonly(value)) {
    // 目标值本身是只读的，判断其 ReactiveFlags.RAW 是否为响应式
    return isReactive((value as Target)[ReactiveFlags.RAW])
  }
  return !!(value && (value as Target)[ReactiveFlags.IS_REACTIVE])
}

/**
 * 判断目标对象是否已建立只读代理
 *
 * @function isReadonly
 * @param {unknown} value 目标值
 * @returns {boolean} 结果
 */
export function isReadonly(value: unknown): boolean {
  return !!(value && (value as Target)[ReactiveFlags.IS_READONLY])
}

/**
 * 判断目标值是否已经建立代理（包括响应式代理或只读代理）
 *
 * @function isProxy
 * @param {unknown} value 目标值
 * @returns {boolean} 结果
 */
export function isProxy(value: unknown): boolean {
  return isReactive(value) || isReadonly(value)
}

/**
 * 递归判断目标值有无 ReactiveFlags.RAW 标记，并返回最内层不含该标记的节点
 *
 * @function toRaw
 * @template T
 * @param {T} observed
 * @returns {any}
 */
export function toRaw<T>(observed: T): T {
  return (
    (observed && toRaw((observed as Target)[ReactiveFlags.RAW])) || observed
  )
}

/**
 * 对目标对象打上 ReactiveFlags.SKIP 标记
 *
 * @function markRaw
 * @template T
 * @param {T} value 目标值
 * @returns {T} 打上标记后返回原对象value
 */
export function markRaw<T extends object>(value: T): T {
  def(value, ReactiveFlags.SKIP, true)
  return value
}
