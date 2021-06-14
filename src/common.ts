/** Misc shared instances. */

import {AbstractBlobStore} from 'abstract-blob-store'
import * as config from 'config'
import {IRouterContext} from 'koa-router'

import {logger} from './logger'

/** Koa context extension. */
export interface KoaContext extends IRouterContext {
    [k: string]: any
    log: typeof logger
    tag: (metadata: any) => void
}

/** Blob storage. */

function loadStore(key: string): AbstractBlobStore {
    const conf = config.get(key) as any
    if (conf.type === 'memory') {
        logger.warn('using memory store for %s', key)
        return require('abstract-blob-store')()
    } else if (conf.type === 'fs') {
        return require('fs-blob-store')('cache')
    } else {
        throw new Error(`Invalid storage type: ${ conf.type }`)
    }
}

export const proxyStore = loadStore('proxy_store')
