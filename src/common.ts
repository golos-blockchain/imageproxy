/** Misc shared instances. */

import {AbstractBlobStore} from 'abstract-blob-store'
import * as config from 'config'
import * as fs from 'fs'
import {IRouterContext} from 'koa-router'

import { logger, } from './logger'

/** Koa context extension. */
export interface KoaContext extends IRouterContext {
    [k: string]: any
    log: typeof logger
    tag: (metadata: any) => void
}

/** Image types allowed to be uploaded and proxied. */
export const AcceptedContentTypes = [
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/tiff',

    // supported, but becomes png on resizing
    'image/svg',
    'image/svg+xml', // if mmmagic will change it in future
]

/** Blob storage. */

const dir = 'cache'

function loadStore(key: string): AbstractBlobStore {
    const conf = config.get(key) as any
    if (conf.type === 'memory') {
        logger.warn('using memory store for %s', key)
        return require('abstract-blob-store')()
    } else if (conf.type === 'fs') {
        return require('fs-blob-store')(dir)
    } else {
        throw new Error(`Invalid storage type: ${ conf.type }`)
    }
}

export function getAccessTime(key: string): any {
    try {
        const stats = fs.statSync(dir + '/' + key)
        return stats.mtime
    } catch (err) {
        return null
    }
}

export function setAccessTime(key: string, atime: any) {
    try {
        if (!atime) {
            atime = new Date()
        } else {
            logger.info('resetting ' + key + ' last access time due a bot')
        }
        fs.utimesSync(dir + '/' + key, atime, atime)
    } catch (err) {
        logger.info('setAccessTime')
        logger.info(err)
    }
}

export const uploadStore = loadStore('upload_store')
export const proxyStore = loadStore('proxy_store')
