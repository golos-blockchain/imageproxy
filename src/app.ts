import * as cors from '@koa/cors'
import * as Bunyan from 'bunyan'
import * as cluster from 'cluster'
import * as config from 'config'
import * as golos from 'golos-lib-js'
import * as http from 'http'
import * as Koa from 'koa'
import * as os from 'os'
import * as util from 'util'

import {KoaContext} from './common'
import {APIError, errorMiddleware} from './error'
import * as isBot from './isBot'
import {logger, loggerMiddleware} from './logger'
import {routes} from './routes'
import {parseBool} from './utils'

if (config.has('node_url')) {
    golos.config.set('websocket', config.get('node_url'))
}
if (config.has('chain_id')) {
    golos.config.set('chain_id', config.get('chain_id'))
}

export const app = new Koa()
export const version = require('./version')

app.proxy = parseBool(config.get('proxy'))

app.on('error', (error, ctx: KoaContext) => {
    const log: Bunyan = ctx.log || logger
    if (error instanceof APIError) {
        if (error.statusCode >= 500) {
            log.error(error.cause || error, 'unexpected api error: %s', error.message)
        } else {
            log.debug(error.cause || error, 'api error: %s', error.message)
        }
    } else {
        log.error(error, 'application error')
    }
})

app.use(loggerMiddleware as any)
app.use(errorMiddleware as any)
app.use(isBot())
app.use(cors())
app.use(routes)
app.use((ctx: Koa.Context) => {
    throw new APIError({code: APIError.Code.NotFound})
})

async function main() {
    if (cluster.isMaster) {
        logger.info({version}, 'starting service')
    }

    const server = http.createServer(app.callback())
    const listen = util.promisify(server.listen).bind(server)
    const close = util.promisify(server.close).bind(server)

    let numWorkers = Number.parseInt(config.get('num_workers'))
    if (numWorkers === 0) {
        numWorkers = os.cpus().length
    }
    const isMaster = cluster.isMaster && numWorkers > 1

    if (isMaster) {
        logger.info('spawning %d workers', numWorkers)
        for (let i = 0; i < numWorkers; i++) {
            cluster.fork()
        }
    } else {
        const port = config.get('port')
        await listen(port)
        logger.info('listening on port %d', port)
    }

    const exit = async () => {
        if (!isMaster) {
            await close()
        }
        return 0
    }

    process.on('SIGTERM', () => {
        logger.info('got SIGTERM, exiting...')
        exit().then((code) => {
            process.exit(code)
        }).catch((error) => {
            logger.fatal(error, 'unable to exit gracefully')
            setTimeout(() => process.exit(1), 1000)
        })
    })
}

if (module === require.main) {
    main().catch((error) => {
        logger.fatal(error, 'unable to start')
        setTimeout(() => process.exit(1), 1000)
    })
}
