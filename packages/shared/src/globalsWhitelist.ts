import { makeMap } from './makeMap'

const GLOBALS_WHITE_LISTED =
  'Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,' +
  'decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,' +
  'Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt'

/**
 * 是否为全局常量白名单
 * @param {string} key
 * @returns {boolean}
 */
export const isGloballyWhitelisted = /*#__PURE__*/ makeMap(GLOBALS_WHITE_LISTED)
