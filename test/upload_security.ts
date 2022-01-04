import 'mocha'
import * as assert from 'assert'
import * as fs from 'fs'
import * as http from 'http'
import * as needle from 'needle'
import * as path from 'path'
import * as Sharp from 'sharp'

import { app } from './../src/app'
import { getGlobals } from './../src/ratelimit'

import { ACC, ACC_LIM, ACC_POSTING, ACC_ACTIVE,
    readFile, clearProfile, checkError, checkNoError } from './common'
import { uploadImage } from './upload'

const port = 63205

const manyAccsPrefix = 'miner-'

function makeAcc(i: any) {
    if (i < 10) i = '0' + i.toString()
    return manyAccsPrefix + i.toString()
}

describe('upload_security', function() {
    const server = http.createServer(app.callback());

    before(function (done) { server.listen(port, 'localhost', done); })
    after(function (done) { server.close(done); })

    beforeEach(async function () {
        await clearProfile(port, ACC_LIM)
        await clearProfile(port, ACC)
        for (let i = 1; i <= 20; ++i) {
            const acc = makeAcc(i)
            await clearProfile(port, acc)
        }
    })

    it('limits', async function() {
        this.timeout(260000);
        var orig = readFile('test6000x4000.jpg')
        const makeImage = async (i: number) => {
            var image = Sharp(orig)
            image.rotate().resize(i, i, {fit: 'cover'})
            var buf = await image.toBuffer()
            return buf
        }
        const upload = async (i: number) => {
            var buf = await makeImage(i)
            var { body, } = await uploadImage({
                data: buf,
                filename: 'limit' + i + '.jpg',
                acc: ACC_LIM,
            })
            return body
        }

        console.log('-- doing 1st upload')

        var i = 1
        var body = await upload(i)
        var after1st = body.ratelimit.uploads_remaining

        console.log('-- doing another uploads')

        var current
        if (after1st) {
            for (i = 2; i <= after1st + 1; ++i) {
                if (i < 3 || i % 20 === 0)
                    console.log('uploading:', i)
                var body = await upload(i)
                current = body.ratelimit.uploads_remaining
                assert.equal(current, after1st - (i - 1))
            }
            assert.equal(current, 0)
        }

        console.log('-- try upload and fail')

        var buf = await makeImage(i)
        var { response, body, } = await uploadImage({
            data: buf,
            filename: 'limit' + i + '.jpg',
            acc: ACC_LIM,
            checkResp: false,
        })
        console.log(body)
        checkError(response, body, 429, 'quota_exceeded')
        assert.equal(body.ratelimit.uploads_remaining, 0)
        assert.equal(body.ratelimit.capacity, 0)
        assert.deepEqual(body.ratelimit.globals, getGlobals())

        console.log('-- check we can upload by another acc')

        var { body, } = await uploadImage({
            data: buf,
            filename: 'limit' + i + '.jpg',
            acc: ACC,
        })
    })

    it('who', async function() {
        this.timeout(30000)

        const key = 'DQmZi174Xz96UrRVBMNRHb6A2FfU3z1HRPwPPQCgSMgdiUT'
        var now = Date.now()
        var { body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            acc: ACC_LIM,
            checkKey: key
        })
        var url = body.url.replace(port + '/', port + '/who/')

        var res = await needle('get', url);
        checkNoError(res, res.body)
        assert.deepEqual(res.body.accounts, [ACC_LIM])

        var res = await needle('get', url + '?detailed=true');
        checkNoError(res, res.body)
        assert.equal(res.body.accounts.length, 1)
        var upload = res.body.accounts[0]
        assert.equal(upload.account, ACC_LIM)

        var uploaders = [ACC_LIM]

        for (let i = 1; i <= 9; ++i) {
            var acc = makeAcc(i)
            console.log('-- uploading also as @' + acc)

            var { body, } = await uploadImage({
                filename: 'test6000x4000.jpg',
                acc,
                checkKey: key
            })
            var url = body.url.replace(port + '/', port + '/who/')

            if (i > 9)
                uploaders.shift()
            uploaders.push(acc)
            uploaders.sort()

            var res = await needle('get', url);
            checkNoError(res, res.body)
            assert.deepEqual(res.body.accounts, uploaders)

            var res = await needle('get', url + '?detailed=true');
            checkNoError(res, res.body)
            assert.equal(res.body.accounts.length, uploaders.length)
            for (let i = 0; i < uploaders.length; ++i) {
                var upload = res.body.accounts[i]
                assert.equal(upload.account, uploaders[i])
            }
        }

        var res = await needle('get', url + '?limit=51');
        assert.equal(res.body.error, 'limit cannot be greater than 50');
        assert.equal(res.statusCode, 500);
    })      

})      

