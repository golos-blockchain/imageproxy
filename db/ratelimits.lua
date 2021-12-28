function ratelimits_bootstrap()
    ratelimits = box.schema.create_space('ratelimits', {
        format = {
            {name = 'account', type = 'str'},
            {name = 'capacity', type = 'unsigned'},
            {name = 'last_action', type = 'unsigned'},
        }
    })
    ratelimits:create_index('primary', {
        type = 'tree', parts = {'account'}, unique = true
    })
end

function ratelimits_get(account)
    local qs = box.space.ratelimits:select{account}
    if #qs > 0 then
        return {
            capacity = qs[1].capacity,
            last_action = qs[1].last_action,
        }
    end
    return {}
end

function ratelimits_set(account, capacity, last_action)
    box.space.ratelimits:upsert({
        account,
        capacity,
        last_action
    }, {
        {'=', 'account', account},
        {'=', 'capacity', capacity},
        {'=', 'last_action', last_action}
    })
end
