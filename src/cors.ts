import * as config from 'config'
import { URL } from 'url'

import { KoaContext } from './common'
import { APIError, } from './error'
import { logger } from './logger'

const SERVICE_URL = new URL(config.get('service_url'))
const ORIGIN_WHITELIST: string[] = []
const whitelistRaw: string[] = config.get('origin_whitelist')
for (const orig of whitelistRaw) {
    if (orig.includes('/')) {
        let url: URL
        try {
            url = new URL(orig)
        } catch (err) {
            throw new Error('This origin_whitelist entry is wrong URL: ' + orig)
        }
        ORIGIN_WHITELIST.push(url.hostname)
    } else {
        ORIGIN_WHITELIST.push(orig)
    }
}

export function checkOrigin(ctx: KoaContext) {
    try {
        if (!ORIGIN_WHITELIST.length) {
            return
        }

        let referer: any = ctx.get('referer')

        const errorOpts = {
            code: APIError.Code.BlacklistedOrigin,
            info: {
                referer: referer.toString(),
                userAgent: ctx.get('user-agent'),
                url: ctx.url
            }
        }

        if (!referer) {
            APIError.assert(ORIGIN_WHITELIST.includes(''), errorOpts)
            return
        }
        try {
            referer = new URL(referer)
        } catch (err) {
            APIError.assert(false, errorOpts)
        }
        if (referer.hostname === SERVICE_URL.hostname) {
            return
        }
        const pass = ORIGIN_WHITELIST.includes(referer.hostname) || ORIGIN_WHITELIST.includes(referer.host)
        APIError.assert(pass, errorOpts)
    } catch (err) {
        logger.warn('CORS failure:')
        if (err instanceof APIError && err.info) {
            logger.warn('URL:', err.info.url)
            logger.warn('Referer:', err.info.referer)
            logger.warn('User-Agent:', err.info.userAgent)
        }
        throw err
    }
}
