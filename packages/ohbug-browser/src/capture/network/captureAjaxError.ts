import { getGlobal, getOhbugObject, warning, replace } from '@ohbug/utils'

import * as types from '../../types'
import { networkDispatcher } from '../../dispatch'
import { AjaxErrorDetail } from '../../handle'

const global = getGlobal<Window>()
const { AJAX_ERROR } = types
const access = 'XMLHttpRequest' in global
const xhrOriginal = access
  ? {
      open: XMLHttpRequest.prototype.open,
      send: XMLHttpRequest.prototype.send,
    }
  : {}

/**
 * capture AJAX_ERROR
 */
export function captureAjaxError() {
  warning(
    access,
    'Binding `AJAX` monitoring failed, the current environment did not find the object `XMLHttpRequest`'
  )
  if (!access) return

  const { client } = getOhbugObject<Window>()

  const desc = {
    method: '',
    url: '',
  }

  const xhrProto = XMLHttpRequest?.prototype

  xhrOriginal.open = replace(
    xhrProto,
    'open',
    (origin) =>
      function call(...args: any[]) {
        const [method, url] = args
        desc.method = method
        desc.url = url
        return origin.apply(this, args)
      }
  )

  xhrOriginal.send = replace(
    xhrProto,
    'send',
    (origin) =>
      function call(...args: any[]) {
        this.addEventListener('readystatechange', function handle() {
          if (this.readyState === 4) {
            if (desc.url !== client._config.endpoint) {
              const detail: AjaxErrorDetail = {
                req: {
                  url: desc.url,
                  method: desc.method,
                  data: args[0] || {},
                },
                res: {
                  status: this.status,
                  statusText: this.statusText,
                  response: this.response,
                },
              }

              client.addAction('ajax', detail, 'ajax')
              if (!this.status || this.status >= 400) {
                networkDispatcher(AJAX_ERROR, detail)
              }
            }
          }
        })
        return origin.apply(this, args)
      }
  )
}

export function removeCaptureAjaxError() {
  if (access && xhrOriginal.open && xhrOriginal.send) {
    const xhrProto = XMLHttpRequest?.prototype
    xhrProto.open = xhrOriginal.open
    xhrProto.send = xhrOriginal.send
  }
}
