
import { KoaContext, } from './common'
import { APIError, } from './error'
import Tarantool from './tarantool'
import { getRateLimit } from './ratelimit'
import { unixMsecToString } from './utils'

export async function profileHandler(ctx: KoaContext) {
    ctx.tag({ handler: 'profile', })

    APIError.assert(ctx.method === 'GET', APIError.Code.InvalidMethod)
    APIError.assertParams(ctx.params, ['profile'])

    const { profile, } = ctx.params
    let { from, limit, detailed, } = ctx.query

    if (limit) limit = parseInt(limit)

    APIError.assert(!limit || limit < 50, 'limit cannot be greater than 50')

    from = from || ''

    limit = limit || 10
    detailed = (detailed === 'true' || detailed === '1')

    let uploads: any = []
    try {
        uploads = await Tarantool.instance('tarantool')
        .call('their_uploads', profile, from, limit+1, detailed)
        uploads = uploads[0] || [];
    } catch (err) {
        ctx.log.error('Cannot get who uploaded', profile, err)
        throw err
    }

    let data: any = { uploads, }
    if (uploads.length === limit+1) {
        let nextKey = uploads[limit].upload_key || uploads[limit]
        let more = ctx.request.origin + '/@' + profile + '?'
        if (detailed) {
            more += 'detailed=1&'
        }
        more += 'from=' + nextKey + '&limit=' + limit
        data.more = {
            link: more,
            from: nextKey,
        }
        uploads.pop()
    }
    for (let i in uploads) {
        const prefix = ctx.request.origin + '/'
        if (detailed) {
            uploads[i] = {
                link: prefix + uploads[i].link,
                upload_key: uploads[i].upload_key,
                uploaded: unixMsecToString(uploads[i].uploaded_msec),
                uploaded_msec: uploads[i].uploaded_msec,
            }
        }
        else {
            uploads[i] = prefix + uploads[i]
        }
    }
    let ratelimit = await getRateLimit(ctx, profile)
    data.ratelimit = ratelimit.toAPI()
    ctx.body = data
}
