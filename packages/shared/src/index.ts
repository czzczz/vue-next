import { makeMap } from './makeMap'

export { makeMap }
export * from './patchFlags'
export * from './shapeFlags'
export * from './slotFlags'
export * from './globalsWhitelist'
export * from './codeframe'
export * from './normalizeProp'
export * from './domTagConfig'
export * from './domAttrConfig'
export * from './escapeHtml'
export * from './looseEqual'
export * from './toDisplayString'

/**
 * List of @babel/parser plugins that are used for template expression
 * transforms and SFC script transforms. By default we enable proposals slated
 * for ES2020. This will need to be updated as the spec moves forward.
 * Full list at https://babeljs.io/docs/en/next/babel-parser#plugins
 */
export const babelParserDefaultPlugins = [
  'bigInt',
  // 可选链式操作符
  'optionalChaining',
  // ?? 操作符
  'nullishCoalescingOperator'
] as const

export const EMPTY_OBJ: { readonly [key: string]: any } = __DEV__
  ? Object.freeze({})
  : {}
export const EMPTY_ARR = __DEV__ ? Object.freeze([]) : []

export const NOOP = () => {}

/**
 * Always return false.
 */
export const NO = () => false

const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)

export const isModelListener = (key: string) => key.startsWith('onUpdate:')

/**
 * 对对象进行非深度的扩展 Object.assign
 */
export const extend = Object.assign

export const remove = <T>(arr: T[], el: T) => {
  const i = arr.indexOf(el)
  if (i > -1) {
    arr.splice(i, 1)
  }
}

const hasOwnProperty = Object.prototype.hasOwnProperty
export const hasOwn = (
  val: object,
  key: string | symbol
): key is keyof typeof val => hasOwnProperty.call(val, key)

/**
 * 判断目标是否为一个数组
 *
 * @param {any} arg 目标
 * @returns {boolean} 结果
 */
export const isArray = Array.isArray

/**
 * 判断目标是否为一个Map
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isMap = (val: unknown): val is Map<any, any> =>
  toTypeString(val) === '[object Map]'

/**
 * 判断目标是否为一个Set
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isSet = (val: unknown): val is Set<any> =>
  toTypeString(val) === '[object Set]'

/**
 * 判断目标是否为一个Date实例
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isDate = (val: unknown): val is Date => val instanceof Date

/**
 * 判断目标是否为一个函数
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isFunction = (val: unknown): val is Function =>
  typeof val === 'function'

/**
 *  判断是否为字符串
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isString = (val: unknown): val is string => typeof val === 'string'

/**
 * 判断一个值是否为symbol
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isSymbol = (val: unknown): val is symbol => typeof val === 'symbol'

/**
 * 判断一个对象是否为引用型变量
 *
 * @param {unknown} val 目标
 * @returns {boolean} 结果
 */
export const isObject = (val: unknown): val is Record<any, any> =>
  val !== null && typeof val === 'object'

export const isPromise = <T = any>(val: unknown): val is Promise<T> => {
  return isObject(val) && isFunction(val.then) && isFunction(val.catch)
}

export const objectToString = Object.prototype.toString
/**
 * 通过Object.prototype.toString获取变量类型
 * 格式为：[object XXX]
 *
 * @param {unknown} value 变量
 * @returns {string} 类型字符串
 */
export const toTypeString = (value: unknown): string =>
  objectToString.call(value)

/**
 * 将变量类型字符串切割出有辨识度的部分
 *
 * @param {unknown} value 变量
 * @returns {string} 类型字符串
 */
export const toRawType = (value: unknown): string => {
  // extract "RawType" from strings like "[object RawType]"
  return toTypeString(value).slice(8, -1)
}

export const isPlainObject = (val: unknown): val is object =>
  toTypeString(val) === '[object Object]'

/**
 * 判断目标是否可作为数组的Key
 *
 * 自然数的字符串，如'1'
 *
 * @param {unknown} key 变量
 * @returns {boolean} 结果
 */
export const isIntegerKey = (key: unknown) =>
  isString(key) &&
  key !== 'NaN' &&
  key[0] !== '-' &&
  '' + parseInt(key, 10) === key

export const isReservedProp = /*#__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ',key,ref,' +
    'onVnodeBeforeMount,onVnodeMounted,' +
    'onVnodeBeforeUpdate,onVnodeUpdated,' +
    'onVnodeBeforeUnmount,onVnodeUnmounted'
)

/**
 * 生成带缓存的处理函数
 *
 * @param {Function} fn
 * @returns {Function}
 */
const cacheStringFunction = <T extends (str: string) => string>(fn: T): T => {
  const cache: Record<string, string> = Object.create(null)
  return ((str: string) => {
    const hit = cache[str]
    return hit || (cache[str] = fn(str))
  }) as any
}

const camelizeRE = /-(\w)/g
/**
 * 短线风格字符串转为小驼峰
 * @private
 */
export const camelize = cacheStringFunction(
  (str: string): string => {
    return str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
  }
)

const hyphenateRE = /\B([A-Z])/g
/**
 * 小驼峰转为连字符风格
 *
 * @private
 */
export const hyphenate = cacheStringFunction((str: string) =>
  str.replace(hyphenateRE, '-$1').toLowerCase()
)

/**
 * 字符串首字母转为大写
 * @private
 */
export const capitalize = cacheStringFunction(
  (str: string) => str.charAt(0).toUpperCase() + str.slice(1)
)

/**
 * @private
 */
export const toHandlerKey = cacheStringFunction(
  (str: string) => (str ? `on${capitalize(str)}` : ``)
)

// compare whether a value has changed, accounting for NaN.
/**
 * 判断新值旧值是否发生变化，NaN也处理了
 * @param {any} value 新值
 * @param {any} oldValue 旧值
 * @returns {boolean} 结果
 */
export const hasChanged = (value: any, oldValue: any): boolean =>
  value !== oldValue && (value === value || oldValue === oldValue)

export const invokeArrayFns = (fns: Function[], arg?: any) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}

/**
 * 为对象设置一个不可枚举的值
 *
 * @param {object} obj
 * @param {string|symbol} key
 * @param {any} value
 */
export const def = (obj: object, key: string | symbol, value: any) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: false,
    value
  })
}

/**
 * 若目标值可通过parseFloat转为数字则转，若为NaN则为原值
 *
 * @param {any} val 目标
 * @returns {any} 转换结果
 */
export const toNumber = (val: any): any => {
  const n = parseFloat(val)
  return isNaN(n) ? val : n
}

let _globalThis: any

/**
 * 获取全局对象
 *
 * @returns {any} 全局对象
 */
export const getGlobalThis = (): any => {
  return (
    _globalThis ||
    (_globalThis =
      typeof globalThis !== 'undefined'
        ? globalThis
        : typeof self !== 'undefined'
          ? self
          : typeof window !== 'undefined'
            ? window
            : typeof global !== 'undefined'
              ? global
              : {})
  )
}
