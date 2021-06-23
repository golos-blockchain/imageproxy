
imageproxy
===========

High-speed, secure image proxying service for GOLOS Blockchain.


Deployment
----------

```
docker build -t golosblockchain/imageproxy .

docker run -d -p 8800:8800 --name golos-imageproxy golosblockchain/imageproxy
```

Docker-Compose
----------

```
version: "3"
services:

  datastore:
    image: golosblockchain/imageproxy:latest
    volumes:
      - ./cache:/app/cache
      - ./production.toml:/app/config/production.toml
    ports:
      - "8800:8800"
```

Developing
----------

Recommended OS is Ubuntu.

```
sudo apt-get remove nodejs
curl -fsSL https://deb.nodesource.com/setup_10.x | sudo -E bash -
sudo apt-get install -y nodejs

npm install --global yarn

sudo apt-get install build-essential
```

Run:

```
make devserver
```

This will pull in all dependencies and spin up a hot-reloading development server.

Run `make lint` to run the autolinter, `make test` to run the unit tests.


Configuration
-------------

Defaults are in <./config/default.toml> and can be overridden by env vars as defined in <./config/custom-environment-variables.toml>

Load order is: env vars > `config/$NODE_ENV.toml` > `config/default.toml`

See the `config` module docs for more details.


API
---

Responses should be determined by the Content-Type header, errors will have a status of `>=400` and a Content-Type of `application/json` with the body in the format:

```json
{
    "error": {
        "name": "error_name",
        "info": {"optional": "metadata"}
    }
}
```

#### `GET /p/<b58_image_url>[?options]` - proxy and resize an image.

Downloads and serves the provided image, note that a copy will be taken of the image and that will be served on subsequent requests so even if the upstream is removed or changes you will still get the original from the proxy endpoint.

##### Params

  * `b58_image_url` - [Base58](https://en.wikipedia.org/wiki/Base58) encoded utf8 string containing the url to the image you wish to proxy.

##### Options

The options are set as query-strings and control how the image is transformed before being proxied.

  * `width` - Desired image width.
  * `height` - Desired image height.
  * `mode` - Resizing mode.
    * `cover` - When set the image will be center cropped if the original aspect ratio does not match the aspect ratio of the upstream image.
    * `fit` - Does not crop the image, it will always keep the upstream aspect ratio and resized to fit within the width and height given.
  * `format` - Output image encoding.
    * `match` - Matches the encoding of the upstream image.
    * `jpeg` - Use JPEG encoding.
    * `png` - Use PNG encoding.
    * `webp` - Use WebP encoding.

If only `width` or `height` are given their counterpart will be calculated based on the upstream image aspect ratio.

##### Examples

Upstream image: `https://ipfs.io/ipfs/QmXa4dAFEhGEuZaX7uUSEvBjbEY5mPxkaS2zHZSnHvocpn` (Base58 encoded `46aP2QbqUqBqwzwxM6L1P6uLNceBDDCM9ZJdv282fpHyc9Wgcz1FduB11aVXtczv9TiCSHF1eEmnRSSdQWQEXA5krJNq`)

Proxy the image:
```
https://devimages.golos.today/p/46aP2QbqUqBqwzwxM6L1P6uLNceBDDCM9ZJdv282fpHyc9Wgcz1FduB11aVXtczv9TiCSHF1eEmnRSSdQWQEXA5krJNq
```

Center cropped 512x512px avatar image in WebP format:
```
https://devimages.golos.today/p/46aP2QbqUqBqwzwxM6L1P6uLNceBDDCM9ZJdv282fpHyc9Wgcz1FduB11aVXtczv9TiCSHF1eEmnRSSdQWQEXA5krJNq?width=512&height=512&format=webp
```

Aspect resized image fitting inside a 200x500px container:
```
https://devimages.golos.today/p/46aP2QbqUqBqwzwxM6L1P6uLNceBDDCM9ZJdv282fpHyc9Wgcz1FduB11aVXtczv9TiCSHF1eEmnRSSdQWQEXA5krJNq?width=200&height=500&mode=fit
```

Aspect resized image with variable width and a height of max 100px:
```
https://devimages.golos.today/p/46aP2QbqUqBqwzwxM6L1P6uLNceBDDCM9ZJdv282fpHyc9Wgcz1FduB11aVXtczv9TiCSHF1eEmnRSSdQWQEXA5krJNq?&height=100
```

#### `GET /<width>x<height>/<image_url>` - proxy and resize an image.

Downloads and serves the provided `image_url`, note that a copy will be taken of the image and that will be served on subsequent requests so even if the upstream is removed or changes you will still get the original from the proxy endpoint.

`width` and `height` can be set to `0` to preserve the image dimensions, if they are `>0` the image will be aspect resized (down-sample only) to fit inside the rectangle.

