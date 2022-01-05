import * as config from 'config'
import * as TarantoolDriver from 'tarantool-driver'

const instance: any = {
    tarantool: null
}

class Tarantool {
    public static instance = (key: string) => {
        if (!instance[key]) {
            instance[key] = new Tarantool(key)
        }
        return instance[key]
    }

    private key: string
    private readyPromise: Promise<any>
    private connection: any

    constructor(key: string) {
        this.key = key
        const host: string = config.get(key + '.host')
        const port: number = config.get(key + '.port')
        const username: string = config.get(key + '.username')
        const password: string = config.get(key + '.password')
        const opts: any = {
            host, port, username, password,
            retryStrategy: null,
            lazyConnect: true,
        }
        const connection = this.connection = new TarantoolDriver(opts)
        this.readyPromise = new Promise((resolve, reject) => {
            connection.connect()
                .then(() => resolve())
                .catch((error: any) => resolve(false))
        })
    }

    public select() {
       return this.makeCall('select', arguments)
    }

    public delete() {
        return this.makeCall('delete', arguments)
    }

    public insert() {
        return this.makeCall('insert', arguments)
    }

    public replace() {
        return this.makeCall('replace', arguments)
    }

    public update() {
        return this.makeCall('update', arguments)
    }

    public eval() {
        return this.makeCall('eval', arguments)
    }

    public call() {
        return this.makeCall('call', arguments)
    }

    public upsert() {
        return this.makeCall('upsert', arguments)
    }

    private makeCall(callName: string, args: any) {
        return this.readyPromise
            .then(() => this.connection[callName].apply(this.connection, args))
            .catch((error) => {
                if (error.message.toLowerCase().indexOf('connect') >= 0) {
                    instance[this.key] = null
                }
                return Promise.reject(error)
            })
    }
}

export default Tarantool
