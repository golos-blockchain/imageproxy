import * as assert from 'assert'
import * as fs from 'fs'
import * as needle from 'needle'
import * as path from 'path'
import * as sharp from 'sharp'

import Tarantool from './../src/tarantool'

export const ACC = 'xel'
export const ACC_POSTING = '5K1aJ8JayUA7c2Ptg9Y2DetKxSvXGXa5GCcvYeHtn1Xh3v4egPS'
export const ACC_ACTIVE = '5JFZC7AtEe1wF2ce6vPAUxDeevzYkPgmtR14z9ZVgvCCtrFAaLw'

// acc to test upload limits
export const ACC_LIM = 'val'

export async function assertThrows(block: () => Promise<any>) {
    try {
        await block()
    } catch (error) {
        return error
    }
    assert.fail('Missing expected exception')
}

export function checkError(response: any, body: any, status: number, message: string, errMessage?: string) {
    assert.equal(body.error, message, errMessage);
    assert.equal(response.statusCode, status, errMessage);
    assert.equal(body.httpStatus, status, errMessage);
    assert.equal(body.status, 'err', errMessage);
}

export function checkNoError(response: any, body?: any) {
    if (body) {
        assert.equal(body.error, undefined);
    }
    assert.equal(response.statusCode, 200);
    if (body) {
        assert.notEqual(body.status, 'err');
        assert(body.httpStatus === undefined || body.httpStatus === 200);
    }
}

export function readFile(filename: string) {
    var file = path.resolve(__dirname, 'images/' + filename);
    var data = fs.readFileSync(file);
    return data;
}

export function fileExists(filename: string) {
    try {
        return fs.statSync(filename).isFile()
    } catch (err) {
        return false
    }
}

async function getProfile(port: number, acc: string, detailed = true) {
    var url = `:${port}/@${acc}?detailed=${detailed}`;
    var res = await needle('get', url);
    checkNoError(res, res.body);
    return res.body;
}

export async function clearProfile(port: number, acc: string) {
    var tar = await Tarantool.instance('tarantool')
        .delete('ratelimits', 'primary', [acc])
    var profile = await getProfile(port, acc)
    var keys = new Set()
    do {
        var { uploads, more, } = profile
        for (let upload of uploads) {
            if (keys.has(upload)) {
                throw 'duplicated upload in profile: ' + upload
            }
            let { link, upload_key } = upload
            keys.add(upload_key)
            assert(link.endsWith('/' + upload_key))

            const f = path.resolve(__dirname, '../cache/' + upload_key)
            if (fileExists(f))
                fs.unlinkSync(f)

            var tar = await Tarantool.instance('tarantool')
                .delete('accounts_uploads', 'by_account_key', [acc, upload_key])
            assert.equal(tar.length, 1)
        }
        if (more) {
            profile = await needle('get', more.link)
            checkNoError(profile, profile.body)
            profile = profile.body
        }
    } while (more)
    var profile = await getProfile(port, acc)
    var { uploads, more, } = profile
    assert.deepEqual(uploads, [])
}

export async function checkImage(url: string, format: string,
    width?: number, height?: number, space = 'srgb', gifPages?: number) {
    var res = await needle('get', url);
    checkNoError(res);
    var image = sharp(res.body);
    var meta = await image.metadata();
    assert.equal(meta.format, format);
    assert.equal(meta.space, space);
    if (width) assert.equal(meta.width, width, 'width');
    if (height) assert.equal(meta.height, height, 'height');
    if (gifPages) assert.equal(meta.pages, gifPages)
}