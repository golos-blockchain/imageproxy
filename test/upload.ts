import 'mocha'
import * as assert from 'assert'
import * as golos from 'golos-lib-js'
import * as http from 'http'
import * as needle from 'needle'
import { URL, } from 'url'

import { app } from './../src/app'
import { ACC, ACC_POSTING, ACC_ACTIVE,
    readFile, checkError, checkNoError, clearProfile, checkImage } from './common'

const port = 63205;

export async function uploadImage({
    data, filename,
    acc = ACC,
    key = { posting: ACC_POSTING, },
    checkResp = true,
    checkKey = '', 
} : {
    data?: Buffer,
    filename: string,
    acc?: string,
    key?: any,
    checkResp?: boolean,
    checkKey?: string,
}) {
    if (!data) {
        data = readFile(filename);
    }
    const signatures = golos.auth.signData(data, key);
    let content_type = 'image/jpeg';
    let types: { [k: string]: string } = {
        '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff',
        '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif',
        '.png': 'image/png',
        '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
    }
    for (let t in types) {
        if (filename.endsWith(t)) {
            content_type = types[t]
            break
        }
    }
    const payload = {
        foo: 'bar',
        image_file: {
            filename,
            buffer: data,
            content_type,
        },
    }
    let signature = (key && key.posting) ? signatures.posting : signatures.active;
    var url = `:${port}/${acc}/${signature}`;
    let { response, body } = await new Promise<any>((resolve, reject) => {
        needle.post(url, payload, {multipart: true}, (error, response, body) => {
            if (error) {
                reject(error)
            } else {
                resolve({ response, body })
            }
        })
    })
    if (checkResp) {
        checkNoError(response, body);

        var uploadUrl = body.url;
        assert(uploadUrl.length, 'image URL is not string: ' + JSON.stringify(uploadUrl));
        assert.doesNotThrow(() => new URL(uploadUrl), 'uploaded url is wrong: ' + url);

        var [ uploadKey, fname, ] = uploadUrl.split('/').slice(-2);
        assert.equal(fname, filename);
        if (checkKey) {
            assert.equal(uploadKey, checkKey);
        }

        var { ratelimit } = body
        var { uploads_remaining } = ratelimit
        assert(Number.isInteger(uploads_remaining))
        assert(uploads_remaining >= 0)
    } else {
        assert(!checkKey);
    }
    return { response, body, data }
}

describe('upload', function() {
    const server = http.createServer(app.callback());

    before(function (done) { server.listen(port, 'localhost', done); })
    after(function (done) { server.close(done); })

    beforeEach(async function () {
        await clearProfile(port, ACC)
    })

    it('should upload jpeg image', async function() {
        this.slow(1000)
        this.timeout(2000)
        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            checkKey: 'DQmZi174Xz96UrRVBMNRHb6A2FfU3z1HRPwPPQCgSMgdiUT',
        })

        var { url, } = body
        await checkImage(url, 'jpeg', 2560, 1707);

        var [ key, fname, ] = url.split('/').slice(-2)
        await checkImage(`:${ port }/${ key }/bla.bla`,
            'jpeg', 2560, 1707)

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 1280, 854)
    })

    it('should upload gif image', async function() {
        this.slow(1000)
        this.timeout(2000)
        var { response, body, } = await uploadImage({
            filename: 'test600x400.gif',
            checkKey: 'DQmf1cT9WXgozLWnkGfYZmHVvuBN8o2wxZ9cnT4YzSmorKa',
        })

        var { url, } = body
        await checkImage(url, 'gif', 600, 400)

        // gifs are not converting to webp to keep animation
        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'gif', 600, 400)
    })

    it('should not upload bmp image', async function() {
        this.slow(1000)
        this.timeout(2000)
        var { response, body, } = await uploadImage({
            filename: 'test.bmp',
            checkResp: false,
        })
        checkError(response, body, 400, 'invalid_image')
    })

    it('should upload png image', async function() {
        this.slow(2000)
        this.timeout(4000)
        var { response, body, } = await uploadImage({
            filename: 'test60x40.png',
            checkKey: 'DQmQjt6cW235TniCJJm7tyWMipLsTh3HdAm142WQ4yreGLd',
        })

        var { url, } = body
        await checkImage(url, 'png', 60, 40)

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 60, 40)

        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.png',
            checkKey: 'DQmNuk4xL1ubmbrDwaKThT4RKHhuEZxUDMbFfPHqFacr9WH',
        })

        var { url, } = body
        await checkImage(url, 'png', 2560, 1707)

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 1280, 854)
    })

    it('should upload webp image', async function() {
        this.slow(2000)
        this.timeout(4000)
        var { response, body, } = await uploadImage({
            filename: 'test60x40.webp',
            checkKey: 'DQmQoB5yBUa5WV3q3UbTFA4m9ug3XXPgKnPVobXhJkZcviN',
        })

        var { url, } = body
        await checkImage(url, 'webp', 60, 40)

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 60, 40)

        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.webp',
            checkKey: 'DQmUfVKETNo9hdhzsSJFDG632fvMQJPh7dKwetFTmj8Z6Tw',
        })

        var { url, } = body
        await checkImage(url, 'webp', 2560, 1707);

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 1280, 854)
    })

    it('should upload tiff image', async function() {
        this.slow(2000);
        this.timeout(4000);
        var { response, body, } = await uploadImage({
            filename: 'test850x1170.tif',
            checkKey: 'DQmVeWbx3W9FWLBssbUEDiXbyLKRJbn7vY7DvEAVecUWGPq',
        })

        var { url, } = body
        await checkImage(url, 'tiff', 850, 1170);

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 850, 1170)

        var { response, body, } = await uploadImage({
            filename: 'test2550x3510.tiff',
            checkKey: 'DQmefJ3QahK6T8eNVZGiTCfxRMoxFRKCCdNDoAr7AGqg9qL',
        })

        var { url, } = body
        await checkImage(url, 'tiff', 2550, 3510, 'b-w');

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 1280, 1762)
    })

    it('should upload svg image (if resize, it will be png)', async function() {
        this.slow(2000)
        this.timeout(4000)
        var { response, body, } = await uploadImage({
            filename: 'test80x80.svg',
            checkKey: 'DQmSz8kKMVTWJVbaUapt6zRFeE9Hdg5TgcZ87dV8f3qxqm7',
        })

        var { url, } = body
        await checkImage(url, 'svg', 80, 80)

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 80, 80)

        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.svg',
            checkKey: 'DQmasiUsvbGVzbdQd5Ud3JJrcvcXsRsP5sfAzLPgPi7DTk6',
        })

        var { url, } = body
        // it will be png because of resize
        await checkImage(url, 'png', 2560, 1707)

        await checkImage(`http://localhost:${ port }/0x0/${ url }`,
            'webp', 1280, 854)
    })

    it('should upload image with active key', async function() {
        this.slow(1000)
        this.timeout(2000)
        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            key: {
                active: ACC_ACTIVE,
            },
            checkKey: 'DQmZi174Xz96UrRVBMNRHb6A2FfU3z1HRPwPPQCgSMgdiUT',
        })
    })

    it('should not upload image with wrong key', async function() {
        this.slow(2000);
        this.timeout(4000);
        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            key: {
                posting: '5HzZHK1P7F8SsxiChHr56X9PoLHMftENgTeFa4EYnNrVbT9zMR3',
            },
            checkResp: false,
        })
        checkError(response, body, 400, 'invalid_signature')

        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            key: {
                active: '5HzZHK1P7F8SsxiChHr56X9PoLHMftENgTeFa4EYnNrVbT9zMR3',
            },
            checkResp: false,
        })
        checkError(response, body, 400, 'invalid_signature')

        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            key: null,
            checkResp: false,
        })
        checkError(response, body, 500, 'internal_error')
    })

    it('should not upload image if blacklisted', async function() {
        this.slow(1000)
        this.timeout(2000)
        var { response, body, } = await uploadImage({
            filename: 'test6000x4000.jpg',
            acc: 'aerostorm2',
            checkResp: false,
        })
        checkError(response, body, 403, 'account_blacklisted')
    })

    it('should not upload invalid image', async function() {
        this.slow(1000)
        this.timeout(2000)
        var { response, body, } = await uploadImage({
            filename: 'invalid.jpg',
            checkResp: false,
        });
        checkError(response, body, 400, 'invalid_image')

        var { response, body, } = await uploadImage({
            filename: 'invalid_empty.png',
            checkResp: false,
        });
        checkError(response, body, 400, 'invalid_image')
    })

    it('should not upload HTML/JS/WASM file (XSS)', async function() {
        this.slow(15000)
        this.timeout(16000)
        var binTypes = ['test.wasm',
            'test.jpg', 'test.jpeg', 'test.jpe', 'test.jfif', 'test.jif', 'test.pjpeg', 'test.pjp',
            'test.png', 'test.gif', 'test.webp', 'test.svg', 'test.svgz',
            'test.tif', 'test.tiff']

        console.log('-- html')
        var data = readFile('test.html');
        for (var name of ['test.html', 'test.js', ...binTypes]) {
            var { response, body, } = await uploadImage({
                filename: name,
                data: data,
                checkResp: false,
            });
            checkError(response, body, 400, 'invalid_image', 'uploaded HTML file: ' + name)
        }
        await clearProfile(port, ACC)

        console.log('-- js')
        var data = readFile('test.js');
        for (var name of ['test.js', 'test.html', ...binTypes]) {
            var { response, body, } = await uploadImage({
                filename: name,
                data: data,
                checkResp: false,
            });
            checkError(response, body, 400, 'invalid_image', 'uploaded JS file: ' + name)
        }
        await clearProfile(port, ACC)

        console.log('-- wasm')
        var data = readFile('test.wasm');
        for (var name of binTypes) {
            var { response, body, } = await uploadImage({
                filename: name,
                data: data,
                checkResp: false,
            });
            checkError(response, body, 400, 'invalid_image', 'uploaded WASM file: ' + name)
        }
        // it becomes parsed as text and signature cannot be validated
        for (var name of ['test.html', 'test.js']) {
            var { response, body, } = await uploadImage({
                filename: name,
                data: data,
                checkResp: false,
            });
            checkError(response, body, 400, 'invalid_signature', 'uploaded WASM file: ' + name)
        }
    })
})
