function accounts_uploads_bootstrap()
    box.schema.sequence.create('accounts_uploads')
    accounts_uploads = box.schema.create_space('accounts_uploads', {
        format = {
            {name = 'id', type = 'unsigned'},
            {name = 'account', type = 'str'},
            {name = 'upload_key', type = 'str'},
            {name = 'uploaded_msec', type = 'unsigned'},
        }
    })
    accounts_uploads:create_index('primary', {
        sequence='accounts_uploads'
    })
    accounts_uploads:create_index('by_key', {
        type = 'tree', parts = {
            'upload_key',
            'account',
        }, unique = true
    })
    accounts_uploads:create_index('by_account', {
        type = 'tree', parts = {
            'account',
            'id', -- sort from older to newest
        }, unique = true
    })
    accounts_uploads:create_index('by_account_key', {
        type = 'tree', parts = {
            'account',
            'upload_key',
        }, unique = true
    })
end

local max_uploads = 50

function record_upload(account, upload_key, uploaded_msec)
    local ex = box.space.accounts_uploads.index.by_key:select{upload_key, account}
    if #ex == 0 then
        local uploads = box.space.accounts_uploads.index.by_account:select{account}
        if #uploads == max_uploads then
            box.space.accounts_uploads:delete(uploads[1].id)
        end
        box.space.accounts_uploads:insert{nil, account, upload_key, uploaded_msec}
    end
end

function who_uploaded(upload_key, start_account, limit, detailed)
    local u = box.space.accounts_uploads.index.by_key:select(
        {upload_key, start_account},
        {
            iterator = 'GE',
            limit = limit,
        })
    local accounts = {}
    for i,val in ipairs(u) do
        if val.upload_key ~= upload_key then
            break
        end
        if detailed then
            accounts[#accounts + 1] = {
                account = val.account,
                uploaded_msec = val.uploaded_msec,
            }
        else
            accounts[#accounts + 1] = val.account
        end
    end
    return accounts
end

function their_uploads(who, start_key, limit, detailed)
    local u = box.space.accounts_uploads.index.by_account_key:select(
        {who, start_key},
        {
            iterator = 'GE',
            limit = limit,
        })
    local uploads = {}
    for i,val in ipairs(u) do
        if val.account ~= who then
            break
        end
        if detailed then
            uploads[#uploads + 1] = {
                link = val.upload_key,
                upload_key = val.upload_key,
                uploaded_msec = val.uploaded_msec,
            }
        else
            uploads[#uploads + 1] = val.upload_key
        end
    end
    return uploads
end
