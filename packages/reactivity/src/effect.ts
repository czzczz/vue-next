import { TrackOpTypes, TriggerOpTypes } from './operations'
import { EMPTY_OBJ, isArray, isIntegerKey, isMap } from '@vue/shared'

// The main WeakMap that stores {target -> key -> dep} connections.
// Conceptually, it's easier to think of a dependency as a Dep class
// which maintains a Set of subscribers, but we simply store them as
// raw Sets to reduce memory overhead.
// 用于存储 目标 { 对象 -> 属性键 -> 副作用 } 的集合。
// Vue3 选择直接通过一个 WeakMap 存储对应的映射关系(便于垃圾回收)
type Dep = Set<ReactiveEffect> // 副作用集合
type KeyToDepMap = Map<any, Dep> // 属性键与副作用的强引用映射
const targetMap = new WeakMap<any, KeyToDepMap>() // target与另外两者的弱引用映射，若target被废弃则对应的依赖关系自动被回收

export interface ReactiveEffect<T = any> {
  (): T
  _isEffect: true
  id: number
  active: boolean
  raw: () => T
  deps: Array<Dep>
  options: ReactiveEffectOptions
  allowRecurse: boolean
}

export interface ReactiveEffectOptions {
  lazy?: boolean
  scheduler?: (job: ReactiveEffect) => void
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
  onStop?: () => void
  allowRecurse?: boolean
}

export type DebuggerEvent = {
  effect: ReactiveEffect
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
} & DebuggerEventExtraInfo

export interface DebuggerEventExtraInfo {
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

/**
 * 执行副作用是会存在嵌套关系（如computed中获取了别的computed）
 * 此为记录调用关系的栈
 */
const effectStack: ReactiveEffect[] = []
/**
 * 当前活跃的副作用
 */
let activeEffect: ReactiveEffect | undefined

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

export function isEffect(fn: any): fn is ReactiveEffect {
  return fn && fn._isEffect === true
}

export function effect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions = EMPTY_OBJ
): ReactiveEffect<T> {
  if (isEffect(fn)) {
    // 该函数已经创建副作用了
    fn = fn.raw
  }
  const effect = createReactiveEffect(fn, options)
  if (!options.lazy) {
    effect()
  }
  return effect
}

export function stop(effect: ReactiveEffect) {
  if (effect.active) {
    cleanup(effect)
    if (effect.options.onStop) {
      effect.options.onStop()
    }
    effect.active = false
  }
}

/**
 * 记录全局的副作用统一Id
 */
let uid = 0

/**
 * 创建一个响应式副作用
 *
 * @function createReactiveEffect
 * @template T
 * @param {() => T} fn 要创建副作用的函数
 * @param {ReactiveEffectOptions} options 配置
 * @returns {ReactiveEffect<T>} 结果
 */
function createReactiveEffect<T = any>(
  fn: () => T,
  options: ReactiveEffectOptions
): ReactiveEffect<T> {
  const effect = function reactiveEffect(): unknown {
    if (!effect.active) {
      // 副作用没有active，若有scheduler则返回空，否则返回目标函数运算结果
      return options.scheduler ? undefined : fn()
    }
    if (!effectStack.includes(effect)) {
      // 清除之前的依赖关系，即每次执行副作用都重新收集依赖
      cleanup(effect)
      try {
        enableTracking()
        effectStack.push(effect)
        activeEffect = effect
        // 将全局的活跃副作用（activeEffect）标记为当前副作用并执行
        // 被响应式代理的变量在被Get的时候会调用track，从而从activeEffect获知变量与副作用的依赖关系
        return fn()
      } finally {
        // fn()执行失败，退栈
        effectStack.pop()
        resetTracking()
        activeEffect = effectStack[effectStack.length - 1]
      }
    }
  } as ReactiveEffect
  effect.id = uid++
  effect.allowRecurse = !!options.allowRecurse
  effect._isEffect = true
  effect.active = true
  effect.raw = fn
  effect.deps = []
  effect.options = options
  return effect
}

/**
 * 清除目标副作用的所有依赖项
 *
 * (以及它依赖的响应式代理保存的副作用记录，双向记录均清除)
 *
 * @function cleanup
 * @param {ReactiveEffect} effect
 */
function cleanup(effect: ReactiveEffect) {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

/**
 * 全局是否允许添加track依赖关系的标志
 */
let shouldTrack = true
const trackStack: boolean[] = []

/**
 * 全局禁止添加依赖关系
 *
 * @function pauseTracking
 * @author czzczz
 */
export function pauseTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

/**
 * 全局允许添加依赖关系
 *
 * @function enableTracking
 * @author czzczz
 */
export function enableTracking() {
  trackStack.push(shouldTrack)
  shouldTrack = true
}

/**
 * 回滚操作记录
 *
 * @function resetTracking
 * @author czzczz
 */
export function resetTracking() {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

/**
 * 对目标对象的目标属性键添加监听
 *
 * @function track
 * @param {object} target 目标引用
 * @param {TrackOpTypes} type 监听的类型
 * @param {unknown} key 监听的属性键
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    // 当前该target没有任何属性被任何副作用监听，则新建对应集合
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    // 当前target对应属性没有被监听，则建立对应集合
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    // 确保该副作用并没有在集合中，防止重复监听
    dep.add(activeEffect)
    // 目标副作用也要记录它对当前的Dep有响应式依赖，响应式代理与副作用均保留对方的引用作为记录
    activeEffect.deps.push(dep)
    if (__DEV__ && activeEffect.options.onTrack) {
      // 开发环境，唤起onTrack生命周期
      activeEffect.options.onTrack({
        effect: activeEffect,
        target,
        type,
        key
      })
    }
  }
}

/**
 * 触发响应式数据的更新
 *
 * @function trigger
 * @author czzczz
 * @param {object} target 目标对象
 * @param {TriggerOpTypes} type 触发类型
 * @param {unknown} [key] 属性键
 * @param {unknown} [newValue] 新值
 * @param {unknown} [oldValue] 旧值
 * @param {Map<unknown, unknown> | Set<unknown>} [oldTarget]
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>
) {
  // 获取目标对象上所有属性的所有副作用，在track时添加的
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    // 没有被 track 过
    return
  }

  const effects = new Set<ReactiveEffect>()
  /**
   * 收集所有要执行的副作用放到 effects 里面
   *
   * @function add
   * @param {Set<ReactiveEffect> | undefined} effectsToAdd 副作用列表
   */
  const add = (effectsToAdd: Set<ReactiveEffect> | undefined) => {
    if (effectsToAdd) {
      effectsToAdd.forEach(effect => {
        if (effect !== activeEffect || effect.allowRecurse) {
          effects.add(effect)
        }
      })
    }
  }

  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    // 要执行清空，对target所有的键的副作用列表触发add
    depsMap.forEach(add)
  } else if (key === 'length' && isArray(target)) {
    // 直接修改数组的length，需要对length的副作用以及键大于新长度的元素的副作用触发add
    // 若当前length为6，有6个元素。外界设置length为4，那么就会收集length的副作用和idx为5，6的元素的副作用
    depsMap.forEach((dep, key) => {
      if (key === 'length' || key >= (newValue as number)) {
        add(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    // 对于set、add和delete等操作，只需要添加对应的属性的副作用就行
    if (key !== void 0) {
      add(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          add(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          add(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            add(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          add(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  /**
   * 执行副作用
   *
   * @function run
   * @param {ReactiveEffect} effect 要执行的目标
   */
  const run = (effect: ReactiveEffect) => {
    if (__DEV__ && effect.options.onTrigger) {
      // 触发生命周期钩子
      effect.options.onTrigger({
        effect,
        target,
        key,
        type,
        newValue,
        oldValue,
        oldTarget
      })
    }
    if (effect.options.scheduler) {
      effect.options.scheduler(effect)
    } else {
      effect()
    }
  }

  // 全部执行
  effects.forEach(run)
}
