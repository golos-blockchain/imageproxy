/** Misc utils. */

import {AbstractBlobStore, BlobKey} from 'abstract-blob-store'
import {Magic, MAGIC_MIME_TYPE} from 'mmmagic'
import * as multihash from 'multihashes'
import * as Sharp from 'sharp'

import { APIError } from './error'

const magic = new Magic(MAGIC_MIME_TYPE)

/** Parse boolean value from string. */
export function parseBool(input: any): boolean {
    if (typeof input === 'string') {
        input = input.toLowerCase().trim()
    }
    switch (input) {
        case true:
        case 1:
        case '1':
        case 'y':
        case 'yes':
        case 'on':
            return true
        case 0:
        case false:
        case '0':
        case 'n':
        case 'no':
        case 'off':
            return false
        default:
            throw new Error(`Ambiguous boolean: ${ input }`)
    }
}

export function safeParseInt(value: any): number | undefined {
    // If the number can't be parsed (like if it's `nil` or `undefined`), then
    // `basicNumber` will be `NaN`.
    const basicNumber = parseInt(value, 10)
    return isNaN(basicNumber) ? undefined : basicNumber
}

/** Convert CamelCase to snake_case. */
export function camelToSnake(value: string) {
    return value
        .replace(/([A-Z])/g, (_, m) => `_${ m.toLowerCase() }`)
        .replace(/^_/, '')
}

/** Read stream into memory. */
export function readStream(stream: NodeJS.ReadableStream) {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        stream.on('data', (chunk) => { chunks.push(chunk) })
        stream.on('error', reject)
        stream.on('end', () => {
            resolve(Buffer.concat(chunks))
        })
    })
}

/** Return mimetype of data. */
export function mimeMagic(data: Buffer) {
    return new Promise<string>((resolve, reject) => {
        magic.detect(data, (error, result) => {
            if (error) { reject(error) } else { resolve(result) }
        })
    })

}

/** Async version of abstract-blob-store exists. */
export function storeExists(store: AbstractBlobStore, key: BlobKey) {
    return new Promise<boolean>((resolve, reject) => {
        store.exists(key, (error, exists) => {
            if (error) {
                reject(error)
            } else {
                resolve(exists)
            }
        })
    })
}

/** Write data to store. */
export function storeWrite(store: AbstractBlobStore, key: BlobKey, data: Buffer | string) {
    return new Promise(async (resolve, reject) => {
        const stream = store.createWriteStream(key, (error, metadata) => {
            if (error) { reject(error) } else { resolve(metadata) }
        })
        stream.write(data)
        stream.end()
    })
}

/** Encode utf8 string with Base58. */
export function base58Enc(value: string): string {
    return multihash.toB58String(Buffer.from(value, 'utf8'))
}

/** Decode utf8 string from Base58. */
export function base58Dec(value: string): string {
    return multihash.fromB58String(value).toString('utf8')
}

export function unixMsecToString(msec: number) {
    return new Date(msec).toISOString().split('.')[0]
}

export async function resizeIfTooLarge(image: Sharp.Sharp, maxWidth?: number, maxHeight?: number) {
    let metadata: Sharp.Metadata
    try {
        metadata = await image.metadata()
    } catch (cause) {
        throw new APIError({cause, code: APIError.Code.InvalidImage})
    }

    APIError.assert(metadata.width && metadata.height, APIError.Code.InvalidImage)

    let width: any
    if (maxWidth && metadata.width && metadata.width > maxWidth) { width = maxWidth }
    let height: any
    if (maxHeight && metadata.height && metadata.height > maxHeight) { height = maxHeight }

    if (width || height) {
        if (!width) { width = maxWidth }
        if (!height) { height = maxHeight }

        image.rotate().resize(width, height, {fit: 'inside', withoutEnlargement: true })
        return image
    }
    return false
}
