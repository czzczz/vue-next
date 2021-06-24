import { isOn } from '@vue/shared'
import { ComponentInternalInstance } from '../component'
import { DeprecationTypes, isCompatEnabled } from './compatConfig'

/**
 * 不应放入attr的参数
 *
 * @function shouldSkipAttr
 * @author czzczz
 * @param {string} key
 * @param {ComponentInternalInstance} instance
 * @returns {any}
 */
export function shouldSkipAttr(
  key: string,
  instance: ComponentInternalInstance
): boolean {
  if (key === 'is') {
    return true
  }
  if (
    (key === 'class' || key === 'style') &&
    isCompatEnabled(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE, instance)
  ) {
    return true
  }
  if (
    isOn(key) &&
    isCompatEnabled(DeprecationTypes.INSTANCE_LISTENERS, instance)
  ) {
    return true
  }
  // vue-router
  if (key.startsWith('routerView') || key === 'registerRouteInstance') {
    return true
  }
  return false
}
