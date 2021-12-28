/** API routes. */

import * as Router from 'koa-router'

import {KoaContext} from './common'
import {legacyProxyHandler} from './legacy-proxy'
import {proxyHandler} from './proxy'
import { profileHandler } from './profile'
import { getGlobals } from './ratelimit'
import { serveHandler } from './serve'
import { uploadHandler } from './upload'
import { whoHandler } from './who'

const version = require('./version')
const router = new Router()

async function healthcheck(ctx: KoaContext) {
    const ok = true
    const date = new Date()
    let ratelimit: any = {
        upload: getGlobals()
    }
    ctx.set('Cache-Control', 'no-cache')
    ctx.body = {ok, version, date, ratelimit}
}

router.get('/', healthcheck as any)
router.get('/.well-known/healthcheck.json', healthcheck as any)
router.get('/who/:hash/:filename?', whoHandler as any)
router.get('/@:profile', profileHandler as any)
router.post('/:username/:signature', uploadHandler as any)
router.get('/:width(\\d+)x:height(\\d+)/:url(.*)', legacyProxyHandler as any)
router.get('/p/:url', proxyHandler as any)
router.get('/:hash/:filename?', serveHandler as any)

export const routes = router.routes()
