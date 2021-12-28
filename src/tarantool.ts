import * as config from 'config'
import * as TarantoolDriver from 'tarantool-driver'

const instance: any = {
  'tarantool': null
};

class Tarantool {
    key: string;
    ready_promise: Promise<any>;
    connection: any;

    constructor(key: string) {
        this.key = key;
        const host: string = config.get(key + '.host');
        const port: number = config.get(key + '.port');
        const username: string = config.get(key + '.username');
        const password: string = config.get(key + '.password');
        let opts: any = {
            host, port, username, password,
            retryStrategy: null,
            lazyConnect: true,
        };
        const connection = this.connection = new TarantoolDriver(opts);
        this.ready_promise = new Promise((resolve, reject) => {
            connection.connect()
                .then(() => resolve())
                .catch((error: any) => resolve(false));
        });
    }

    makeCall(call_name: string, args: any) {
        return this.ready_promise
            .then(() => this.connection[call_name].apply(this.connection, args))
            .catch(error => {
                if (error.message.toLowerCase().indexOf('connect') >= 0)
                    instance[this.key] = null;
                return Promise.reject(error);
            });
    }

    select() {
       return this.makeCall('select', arguments);
    }
    delete() {
        return this.makeCall('delete', arguments);
    }
    insert() {
        return this.makeCall('insert', arguments);
    }
    replace() {
        return this.makeCall('replace', arguments);
    }
    update() {
        return this.makeCall('update', arguments);
    }
    eval() {
        return this.makeCall('eval', arguments);
    }
    call() {
        return this.makeCall('call', arguments);
    }
    upsert() {
        return this.makeCall('upsert', arguments);
    }

    public static instance = function (key: string) {
        if (!instance[key]) instance[key] = new Tarantool(key);
        return instance[key];
    }
}

export default Tarantool;
