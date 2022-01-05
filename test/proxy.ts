import 'mocha'
import * as assert from 'assert'
import * as http from 'http'
import * as needle from 'needle'
import * as multihash from 'multihashes'
import * as path from 'path'
import * as fs from 'fs'
import * as sharp from 'sharp'

import {app} from './../src/app'
import {storeExists, base58Enc} from './../src/utils'

import { checkNoError, checkImage } from './common'

describe('proxy', function() {
    const port = 63205
    const server = http.createServer(app.callback())

    before((done) => { server.listen(port, 'localhost', done) })
    after((done) => { server.close(done) })

    needle.defaults({follow_max: 1})

    let serveImage = true
    const imageServer = http.createServer((req, res) => {
        if (serveImage) {
            fs.createReadStream(path.resolve(__dirname, 'images' + req.url)).pipe(res)
        } else {
            res.writeHead(404)
            res.end()
        }
    })

    before((done) => { imageServer.listen(port+1, 'localhost', done) })
    after((done) => { imageServer.close(done) })

    beforeEach(function () {
        var dir = path.resolve(__dirname, '../cache')
        var files = fs.readdirSync(dir)
        for (var f of files) {
            if (f.startsWith('U')) {
                var filePath = path.resolve(dir, f) 
                fs.unlinkSync(filePath)
            }
        }
    })

    it('should proxy', async function() {
        this.slow(1000)
        var res = await needle('get', `http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test6000x4000.jpg`)
        checkNoError(res, res.body)
        var image = sharp(res.body)
        var meta = await image.metadata()
        assert.equal(meta.width, 1280)
        assert.equal(meta.height, 853)
        assert.equal(meta.format, 'webp')
        assert.equal(meta.space, 'srgb')
    })

    it('should proxy and resize', async function() {
        this.slow(1000)
        var res = await needle('get', `http://localhost:${ port }/100x0/http://localhost:${ port+1 }/test6000x4000.jpg`)
        checkNoError(res, res.body)
        var image = sharp(res.body)
        var meta = await image.metadata()
        assert.equal(meta.width, 100)
        assert.equal(meta.height, 67)
        assert.equal(meta.format, 'webp')
        assert.equal(meta.space, 'srgb')
    })

    it('should proxy stored image when source is gone', async function() {
        serveImage = true
        var res = await needle('get', `http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test6000x4000.jpg`)
        serveImage = false
        var res = await needle('get', `http://localhost:${ port }/100x0/http://localhost:${ port+1 }/test6000x4000.jpg`)
        checkNoError(res, res.body)
        var image = sharp(res.body)
        var meta = await image.metadata()
        assert.equal(meta.width, 100)
        assert.equal(meta.height, 67)
        assert.equal(meta.format, 'webp')
        assert.equal(meta.space, 'srgb')
    })

    it('should proxy using new api', async function() {
        this.slow(1000)
        serveImage = true
        var res = await needle('get', `http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test6000x4000.jpg`)
        checkNoError(res, res.body)
        serveImage = false
        var imageUrl = base58Enc(`http://localhost:${ port+1 }/test6000x4000.jpg`)
        var res = await needle('get', `http://localhost:${ port }/p/${ imageUrl }?width=100&height=100&format=webp`)
        checkNoError(res, res.body)
        var image = sharp(res.body)
        var meta = await image.metadata()
        assert.equal(meta.width, 100)
        assert.equal(meta.height, 100)
        assert.equal(meta.format, 'webp')
        assert.equal(meta.space, 'srgb')
    })

    it('should resolve double proxied images', async function() {
        this.slow(1000)
        serveImage = true
        var res = await needle('get', `http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test6000x4000.jpg`)
        checkNoError(res, res.body)
        serveImage = false
        var imageUrl = base58Enc(`http://localhost:${ port+1 }/test6000x4000.jpg`)
        var url1 = `http://localhost:${ port }/p/${ imageUrl }?width=100&height=100`
        var url2 = `http://localhost:${ port }/p/${ base58Enc(url1) }?width=200`
        var res = await needle('get', url2)
        checkNoError(res, res.body)
        console.log(res.body)
        var image = sharp(res.body)
        var meta = await image.metadata()
        assert.equal(meta.width, 200)
        // this would be 200 if the first url wasn't stripped
        assert.equal(meta.height, 133)
    })

    it('should proxy gif image', async function() {
        this.slow(1000)
        serveImage = true
        await checkImage(`http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test600x400.gif`,
            'gif', 600, 400, 'srgb', 20)
        await checkImage(`http://localhost:${ port }/36x36/http://localhost:${ port+1 }/test600x400.gif`,
            'webp', 36, 24)
        serveImage = false
        await checkImage(`http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test600x400.gif`,
            'gif', 600, 400, 'srgb', 20)
        await checkImage(`http://localhost:${ port }/36x36/http://localhost:${ port+1 }/test600x400.gif`,
            'webp', 36, 24)
    })

    it('should proxy png image', async function() {
        this.slow(1000)
        serveImage = true
        await checkImage(`http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test60x40.png`,
            'webp', 60, 40)
        await checkImage(`http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test6000x4000.png`,
            'webp', 1280, 853)
        var imageUrl = base58Enc(`http://localhost:${ port+1 }/test60x40.png`)
        await checkImage(`http://localhost:${ port }/p/${ imageUrl }?width=60&height=40&format=match`,
            'png', 60, 40)
        var imageUrl = base58Enc(`http://localhost:${ port+1 }/test6000x4000.png`)
        await checkImage(`http://localhost:${ port }/p/${ imageUrl }?width=6000&height=4000&format=match`,
            'png', 2560, 1440)

        serveImage = false
        await checkImage(`http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test60x40.png`,
            'webp', 60, 40)
        await checkImage(`http://localhost:${ port }/0x0/http://localhost:${ port+1 }/test6000x4000.png`,
            'webp', 1280, 853)
        var imageUrl = base58Enc(`http://localhost:${ port+1 }/test60x40.png`)
        await checkImage(`http://localhost:${ port }/p/${ imageUrl }?width=60&height=40&format=match`,
            'png', 60, 40)
        var imageUrl = base58Enc(`http://localhost:${ port+1 }/test6000x4000.png`)
        await checkImage(`http://localhost:${ port }/p/${ imageUrl }?width=6000&height=4000&format=match`,
            'png', 2560, 1440)
    })
})
