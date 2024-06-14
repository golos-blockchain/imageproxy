
import * as config from 'config'

import { KoaContext, } from './common'
import Tarantool from './tarantool'

export const UPLOAD_LIMITS = initUploadLimits(config.get('upload_limits') as any)

function initUploadLimits(limits: any) {
    const res = {...limits}
    if (res.duration > 1576800) {
        throw new Error('upload_limits.duration cannot be greater than 1576800 (3 years)')
    }
    if (res.max <= 0) {
        throw new Error('upload_limits.max should be positive')
    }
    if (res.max > res.duration) {
        throw new Error('upload_limits.max cannot be greater than upload_limits.duration')
    }
    const consumption = res.duration / res.max
    const floor = Math.floor(consumption)
    if (floor !== consumption) {
        res.duration = (floor + 1) * res.max
    }
    if (res.golos_power && typeof(res.golos_power) !== 'number') {
        throw new Error('upload_limits.golos_power should be a number, like 10, or 10.2, which means 10.000 GOLOS or 10.200 GOLOS. Or just omit it')
    }
    return res
}

export function getGlobals() {
    return {
        period_minutes: UPLOAD_LIMITS.duration,
        uploads_per_period: UPLOAD_LIMITS.max,
    }
}

export class RateLimit {
    public static fromDB(record: any, account: string) {
        const limit = new RateLimit()
        limit.account = account

        if (record) {
            limit.capacity = record.capacity
            limit.last_action = record.last_action
        }

        if (UPLOAD_LIMITS.max === 0) {
            limit.exceeded = true
            limit.remaining = 0
            // but do not clear account capacity, because this 0 can be mistake
            return limit
        }

        limit.consumptionPer1 = Math.floor(UPLOAD_LIMITS.duration / UPLOAD_LIMITS.max)

        limit.now = Math.floor(Date.now() / (60 * 1000))
        limit.elapsedMinutes = limit.now - limit.last_action
        const regeneratedCapacity = Math.min(
            UPLOAD_LIMITS.duration,
            limit.elapsedMinutes)
        limit.capacity = Math.min(
            (limit.capacity + regeneratedCapacity),
            UPLOAD_LIMITS.duration)

        limit.calcRemaining()

        return limit
    }

    // db data
    public account = ''
    public capacity = UPLOAD_LIMITS.duration
    /* tslint:disable-next-line */
    public last_action = 0
    // custom
    /* tslint:disable-next-line */
    public retry_after_minutes = 0
    public exceeded = false
    public remaining = 0
    public consumptionPer1 = 0
    public elapsedMinutes = 0
    public now = 0

    public consume() {
        this.capacity = Math.max(this.capacity - this.consumptionPer1, 0)
        this.last_action = this.now

        this.calcRemaining()
    }

    public toAPI() {
        const obj: any = {
            uploads_remaining: this.remaining,
        }
        if (this.exceeded) {
            obj.retry_after_minutes = this.retry_after_minutes
        }
        // technical data, it is at the bottom
        obj.capacity = this.capacity
        obj.last_action_unix_minutes = this.last_action
        obj.globals = getGlobals()
        return obj
    }

    private calcRemaining() {
        if (this.capacity < this.consumptionPer1) {
            this.exceeded = true
            this.retry_after_minutes = this.consumptionPer1 - this.elapsedMinutes
            if (this.retry_after_minutes < 0) {
                this.retry_after_minutes = UPLOAD_LIMITS.duration
            }
        }
        this.remaining = Math.floor(this.capacity / this.consumptionPer1)
    }
}

export async function getRateLimit(ctx: KoaContext, account: string) {
    let limit: RateLimit

    let record: any
    try {
        record = await Tarantool.instance('tarantool')
            .call('ratelimits_get', account)
        record = record[0][0]
    } catch (err) {
        ctx.log.error('Cannot get ratelimit for', account, err)
        throw err
    }
    limit = RateLimit.fromDB(record, account)

    return limit
}

export async function saveRateLimit(ctx: KoaContext, limit: RateLimit) {
    try {
        await Tarantool.instance('tarantool')
        .call('ratelimits_set', limit.account,
            limit.capacity, limit.last_action)
    } catch (err) {
        ctx.log.error('Cannot update ratelimit for', limit.account, err)
        throw err
    }
}
