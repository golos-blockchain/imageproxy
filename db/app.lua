require 'ratelimits'
require 'accounts_uploads'

io.output():setvbuf('no')

box.cfg {
    log_level = 5,
    listen = '0.0.0.0:49003',
    memtx_memory = 1 * 1024 * 1024 * 1024,
    wal_dir   = '/var/lib/tarantool',
    memtx_dir  = '/var/lib/tarantool',
    vinyl_dir = '/var/lib/tarantool'
}

box.once('bootstrap', function()
    print('initializing..')
    box.schema.user.grant('guest', 'read,write,execute,create,drop,alter ', 'universe')
    box.session.su('guest')

    ratelimits_bootstrap()
    accounts_uploads_bootstrap()
end)
