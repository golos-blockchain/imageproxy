const fs = require('fs')
const readline = require('node:readline')

const config = require('config')

const max_avatar_width = parseInt(config.get('proxy_store.max_avatar_width'))
const max_avatar_height = parseInt(config.get('proxy_store.max_avatar_height'))

let dir = 'cache'
let seconds = 12
let silent = false
const { argv } = process
if (argv[2]) {
    dir = argv[2]
}
if (argv[3]) {
    seconds = parseFloat(argv[3])
}
if (argv[4] === 'silent') {
    silent = true
}
seconds = Math.floor(seconds * (30*24*3600))

const ago = new Date()
ago.setSeconds(ago.getSeconds() - seconds)

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
})

const getAllFiles = (path) => {
    return fs.readdirSync(path, { withFileTypes: true })
        .filter(item => !item.isDirectory())
        .map(item => item.name)
}

if (!fs.existsSync(dir)) {
    console.log(dir + ' not exists.')
    console.log('Usage is:')
    console.log('')
    console.log('node cleanup.js')
    console.log('(if cache is in current shell directory)')
    console.log('')
    console.log('node cleanup.js /absolute/path/to/cache')
    console.log('')
    console.log('node cleanup.js /absolute/path/to/cache 5')
    console.log('(5 is months ago. Default is 12)')
    console.log('')
    console.log('node cleanup.js /absolute/path/to/cache 5 silent')
    console.log('(same, but without Y/N question)')
    console.log('')
    console.log('node cleanup.js /?')
    console.log('(displays this help)')
    process.exit(1)
}

console.log('Scanning...')

const imgs = {}
for (const file of getAllFiles(dir)) {
    if (!file.startsWith('U')) {
        continue
    }
    const parts = file.split('_')
    const key = parts[0]
    if (!imgs[key]) {
        imgs[key] = { }
    }
    imgs[key].copies = imgs[key].copies ? imgs[key].copies + 1 : 1
    if (parts.length === 1) {
        try {
            const stats = fs.statSync(dir + '/' + key) // We will clean up only originals
            imgs[key].size = stats.size
            imgs[key].mtime = stats.mtime
        } catch (err) {
            continue
        }
    } else if (parts.length >= 3) {
        let width = parts[parts.length - 2]
        let height = parts[parts.length - 1]
        if (!isNaN(width) && !isNaN(height)) {
            width = parseInt(width)
            height = parseInt(height)
            if (width <= max_avatar_width && height <= max_avatar_height) {
                imgs[key].hasAvatar = true
            }
            if (width === 256 && height === 512) {
                imgs[key].hasPreview = true
            }
            if (width === 800 && height === 600) {
                imgs[key].hasPreview = true
            }
        }
    }
}

let sizes = 0
let sizesAva = 0
let sizesPreview = 0
let count = 0

for (let img of Object.values(imgs)) {
    if (img.copies < 2 || !img.mtime || img.mtime > ago) {
        continue
    }
    count++
    const size = img.size / 1024
    if (img.hasPreview) {
        sizesPreview += size
    } else if (img.hasAvatar) {
        sizesAva += size
    } else {
        sizes += size
    }
}

async function main() {
    if (count === 0) {
        console.log('No files for cleanup.')
        rl.close()
        return
    }

    console.log('We can clean ' + count + ' files.')
    console.log('- Avatar images are ' + sizesAva.toFixed(2) + ' KB total.')
    console.log('- Preview images are ' + sizesPreview.toFixed(2) + ' KB total.')
    console.log('- Other images are ' + sizes.toFixed(2) + ' KB total.')

    if (!silent) {
        console.log('Clean ALL these? (wait 2sec)')
        await new Promise(resolve => setTimeout(resolve, 2000))
    }

    const proceed = () => {
        console.log('Cleanup...')
        for (let [key, data] of Object.entries(imgs)) {
            if (data.copies < 2) {
                continue
            }
            try {
                fs.rmSync(dir + '/' + key)
            } catch (err) {
                console.error(key, 'cannot be removed.', err)
            }
        }
        console.log('Cleanup done.')
    }

    if (silent) {
        proceed()
        rl.close()
    } else {
        rl.question('Answer Y or N: ', answer => {
            if (answer !== 'Y') {
                console.log('OK, canceled.')
            } else {
                proceed()
            }
            rl.close()
        })
    }
}

main()
