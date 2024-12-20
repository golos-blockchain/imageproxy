FROM node:14-alpine as build-stage

WORKDIR /app

# install build dependencies
RUN apk add \
    --no-cache \
    bash \
    build-base \
    fftw-dev \
    git \
    make \
    python3

# install application dependencies
COPY package.json yarn.lock ./
RUN JOBS=max yarn install --non-interactive --frozen-lockfile

# copy in application source
COPY . .

# run tests and build typescript sources
RUN make lib ci-test

# prune modules
RUN yarn install --non-interactive --frozen-lockfile --production

# copy built application to runtime image
FROM node:14-alpine
WORKDIR /app
RUN apk add \
    --no-cache \
    --repository https://alpine.global.ssl.fastly.net/alpine/v3.10/community \
    fftw
COPY --from=build-stage /app/config config
COPY --from=build-stage /app/lib lib
COPY --from=build-stage /app/node_modules node_modules
COPY --from=build-stage /app/cleanup.js cleanup.js

# run in production mode
ENV NODE_ENV production
ENV NODE_CONFIG_ENV production,blacklist
CMD [ "node", "lib/app.js" ]
