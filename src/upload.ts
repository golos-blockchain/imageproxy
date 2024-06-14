/** Uploads file to blob store. */
import * as Busboy from 'busboy'
import * as config from 'config'
import { createHash, } from 'crypto'
import * as fs from 'fs'
import * as golos from 'golos-lib-js'
import * as http from 'http'
import * as multihash from 'multihashes'
import * as Sharp from 'sharp'
import { URL } from 'url'

import { AcceptedContentTypes, KoaContext, uploadStore } from './common'
import { checkOrigin } from './cors'
import { APIError, } from './error'
import { getRateLimit, saveRateLimit, UPLOAD_LIMITS } from './ratelimit'
import Tarantool from './tarantool'
import { mimeMagic, readStream, resizeIfTooLarge, safeParseInt, storeExists, storeWrite } from './utils'

const configNumber = (key: string): number => {
    const val = Number.parseInt(config.get(key))
    if (!Number.isFinite(val)) {
        throw new Error('Invalid ' + key)
    }
    return val
}
const MIN_IMAGE_SIZE = configNumber('upload_store.min_image_size')
const MAX_IMAGE_SIZE = configNumber('upload_store.max_image_size')

const SERVICE_URL = new URL(config.get('service_url'))
let ACCOUNT_BLACKLIST: string[]
try {
    ACCOUNT_BLACKLIST = config.get('account_blacklist')
} catch (err) {
    throw new Error('No account_blacklist in config. It looks like NODE_CONFIG_ENV does not contain blacklist.json')
}

/**
 * Parse multi-part request and return first file found.
 */
async function parseMultipart(request: http.IncomingMessage, fields?: { [key: string]: any }) {
    return new Promise<{stream: NodeJS.ReadableStream, mime: string, name: string}>((resolve, reject) => {
        const form = new Busboy({
            headers: request.headers,
            limits: {
                files: 1,
                fileSize: MAX_IMAGE_SIZE,
            },
        })
        if (fields) {
            form.on('field', (name, val, info) => {
                fields[name] = val
            })
        }
        form.on('file', (field, stream, name, encoding, mime) => {
            resolve({stream, mime, name})
        })
        form.on('error', reject)
        form.on('finish', () => {
            reject(new APIError({code: APIError.Code.FileMissing}))
        })
        request.pipe(form)
    })
}

async function checkGolosPower(account: any) {
    const { golos_power } = UPLOAD_LIMITS
    if (golos_power) {
        const gprops = await golos.api.getDynamicGlobalPropertiesAsync()
        const { Asset } = golos.utils
        const { vestToGolos } = golos.formatter

        const { vesting_shares,
            delegated_vesting_shares, emission_delegated_vesting_shares,
            received_vesting_shares, emission_received_vesting_shares, } = account
        let vs = await Asset(vesting_shares)
        // vs = vs.minus(Asset(delegated_vesting_shares))
        // vs = vs.minus(Asset(emission_delegated_vesting_shares))
        // vs = vs.plus(Asset(received_vesting_shares))
        // vs = vs.plus(Asset(emission_received_vesting_shares))
        vs = vestToGolos(vs, gprops.total_vesting_shares, gprops.total_vesting_fund_steem)
        const vsF = parseFloat(vs.amountFloat)
        const required = Asset(0, 3, 'GOLOS')
        required.amountFloat = golos_power.toFixed(3)
        APIError.assert(vsF > golos_power, {
            code: APIError.Code.TooLowAccountGolosPower,
            info: {
                power: vs.toString(),
                required: required.toString()
            }
        })
    }
}

export async function startUploadHandler(ctx: KoaContext) {
    ctx.tag({ handler: 'start_upload', })

    APIError.assertParams(ctx.params, [ 'size', ])

    const imgSize = Number.parseInt(ctx.params['size'])

    const recommended = imgSize >= MIN_IMAGE_SIZE

    ctx.status = 200
    ctx.body = {
        recommended,
        max_image_size: MAX_IMAGE_SIZE,
        min_image_size: MIN_IMAGE_SIZE,
        hint: 'max_image_size is limit, min_image_size is recommendation'
    }
}

export async function uploadHandler(ctx: KoaContext) {
    ctx.tag({ handler: 'upload', })

    APIError.assert(ctx.method === 'POST', { code: APIError.Code.InvalidMethod, })
    APIError.assertParams(ctx.params, [ 'username', 'signature', ])

    APIError.assert(ctx.get('content-type').includes('multipart/form-data'),
                    { message: 'Only multipart uploads are supported', })

    const contentLength = Number.parseInt(ctx.get('content-length'))

    APIError.assert(Number.isFinite(contentLength), APIError.Code.LengthRequired)
    APIError.assert(contentLength <= MAX_IMAGE_SIZE, APIError.Code.PayloadTooLarge)

    checkOrigin(ctx)

    const fields: { [key: string]: any } = {}
    const file = await parseMultipart(ctx.req, fields)
    const data = await readStream(file.stream)

    // extra check if client manges to lie about the content-length
    APIError.assert((file.stream as any).truncated !== true,
                    APIError.Code.PayloadTooLarge)

    const imageHash = createHash('sha256')
        .update('ImageSigningChallenge')
        .update(data)
        .digest()

    const [ account, ] = await golos.api.getAccounts([ctx.params['username']])
    APIError.assert(account, APIError.Code.NoSuchAccount)

    const verified = golos.auth.verifySignedData(data, {
        posting: ctx.params.signature,
        active: ctx.params.signature,
    }, account, ['posting', 'active'])

    APIError.assert(verified.posting || verified.active, APIError.Code.InvalidSignature)

    APIError.assert(!ACCOUNT_BLACKLIST.includes(account.name), APIError.Code.AccountBlacklisted)

    const limit = await getRateLimit(ctx, account.name)

    APIError.assert(!limit.exceeded, {
        code: APIError.Code.QuotaExceeded,
        info: { ratelimit: limit.toAPI() },
    })

    try {
        limit.consume()
        await saveRateLimit(ctx, limit)
    } catch (error) {
        ctx.log.error(error, 'Rate limit broken', account.name, limit)
        throw error
    }

    const reputation = golos.formatter.reputation(account.reputation, true)
    APIError.assert(reputation >= UPLOAD_LIMITS.reputation, {
        code: APIError.Code.TooLowAccountReputation,
        info: {
            required: UPLOAD_LIMITS.reputation,
            reputation
        }
    })

    await checkGolosPower(account)

    const key = 'D' + multihash.toB58String(multihash.encode(imageHash, 'sha2-256'))
    const url = new URL(`${ key }/${ file.name }`, SERVICE_URL)

    if (fields['fallback']) {
        ctx.log.error('Imgur failure:', fields['fallback'], url.toString())
    }

    let meta: any = {
        mime_type: file.mime,
        width: 0,
        height: 0,
        size_bytes: 0,
    }

    const exists = await storeExists(uploadStore, key)
    if (exists) {
        try {
            const res = await Tarantool.instance('tarantool')
                .call('get_existant_upload', key)
            meta = res[0][0] || meta
        } catch (err) {
            ctx.log.error('Cannot get upload of', key, err)
        }
    }
    if (!exists || !meta.width || !meta.size_bytes) {
        APIError.assert(data.length > 0, APIError.Code.InvalidImage)

        const contentType = await mimeMagic(data)
        APIError.assert(AcceptedContentTypes.includes(contentType), APIError.Code.InvalidImage)

        const image = Sharp(data)

        const maxWidth: number|undefined = safeParseInt(config.get('upload_store.max_store_image_width'))
        const maxHeight: number|undefined = safeParseInt(config.get('upload_store.max_store_image_height'))

        const resized = await resizeIfTooLarge(image, maxWidth, maxHeight)

        let buf = data
        if (resized) {
            buf = await resized.toBuffer()
        }

        const metadata = await Sharp(buf).metadata()
        if (metadata.width) { meta.width = metadata.width }
        if (metadata.height) { meta.height = metadata.height }
        if (metadata.size) { meta.size_bytes = metadata.size }
        // SVGs are converting to PNG if resized
        if (metadata.format === 'png') { meta.mime_type = 'image/png' }

        await storeWrite(uploadStore, key, buf)
    } else {
        ctx.log.debug('key %s already exists in store', key)
        meta.already_uploaded = true
    }

    try {
        await Tarantool.instance('tarantool')
            .call('record_upload', account.name, key, Date.now(),
                meta.mime_type, meta.width, meta.height, meta.size_bytes)
    } catch (err) {
        ctx.log.error('Cannot record upload for', account.name, key, err)
        throw err
    }

    ctx.log.info({
        uploader: account.name,
        size: data.byteLength,
    }, 'image uploaded')

    ctx.status = 200
    ctx.body = {
        url,
        meta,
        ratelimit: limit.toAPI(),
    }
}
