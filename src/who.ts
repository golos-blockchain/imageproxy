
import { KoaContext, } from './common'
import { APIError, } from './error'
import Tarantool from './tarantool'
import { unixMsecToString } from './utils'

export async function whoHandler(ctx: KoaContext) {
    ctx.tag({ handler: 'who', })

    APIError.assert(ctx.method === 'GET', APIError.Code.InvalidMethod)
    APIError.assertParams(ctx.params, ['hash'])

    const { hash, } = ctx.params
    let { from, limit, detailed, } = ctx.query

    if (limit) limit = parseInt(limit)

    APIError.assert(!limit || limit < 50, 'limit cannot be greater than 50')

    from = from || ''

    limit = limit || 10
    detailed = (detailed === 'true' || detailed === '1')

    let accounts: any = []
    try {
        accounts = await Tarantool.instance('tarantool')
        .call('who_uploaded', hash, from, limit+1, detailed)
        accounts = accounts[0] || [];
    } catch (err) {
        ctx.log.error('Cannot get who uploaded', hash, err)
        throw err
    }

    let data: any = { accounts, }
    if (accounts.length === limit+1) {
        let nextAcc = accounts[limit].account || accounts[limit]
        let more = ctx.request.origin + '/who/' + hash + '?'
        if (detailed) {
            more += 'detailed=1&'
        }
        more += 'from=' + nextAcc + '&limit=' + limit
        data.more = {
            link: more,
            from: nextAcc,
        }
        accounts.pop()
    }
    if (detailed) {
        for (let i in accounts) {
            accounts[i] = {
                account: accounts[i].account,
                uploaded: unixMsecToString(accounts[i].uploaded_msec),
                uploaded_msec: accounts[i].uploaded_msec,
            }
        }
    }
    ctx.body = data
}
