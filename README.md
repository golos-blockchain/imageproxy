
imageproxy
===========

Быстрое, безопасное и удобное хранилище изображений для блокчейна GOLOS.

- Поддерживает форматы PNG, JPEG, GIF, TIFF, SVG, WEBP. Для фотографий, изображений со сканеров, для рисунков и скриншотов.
- Позволяет проксировать изображения, загружаемые пользователями по ссылкам. Изображение будет доступно даже если оригинальная ссылка перестанет работать.
- Ускоряет загрузку таких изображений.
- Обеспечивает безопасность, в отличие от вставки по ссылкам напрямую.
- Можно делать миниатюры изображений и аватаров, уменьшать размер изображений на сервере. Это оптимально для быстродействия и SEO.
- Возможность преобразовывать изображения в формат WEBP, PNG или JPEG. Преобразование в JPEG или PNG позволяет изображениям корректно отображаться даже в старых браузерах. WEBP дает наибольшую оптимальность. Преобразование автоматическое и мгновенное.
- Способен хранить изображения, загружаемые пользователями с компьютеров (файлы).
- Есть возможность просматривать список изображений, загруженных пользователем.

Сервис базируется по адресу https://images.golos.today/, документация на API дана [ниже](#api).  
Для экспериментов лучше использовать dev-версию сервиса: https://devimages.golos.today/

Все возможности, за исключением проксирования, доступны без согласования с нами.  
В случае проксирования, **предварительно нужно попросить нас** добавить домен вашего сервиса в наш белый список. И ваш сайт должен отправлять этот домен в заголовке `Referrer`, когда загружает в `<img>` картинки с нашего сервиса. По умолчанию на сайтах так и происходит. Но если вы настроили `Referrer-Policy`, то необходимо использовать такие значения, как `strict-origin` или `no-referrer-when-downgrade`, которые тоже обеспечивают безопасность, и в то же время не мешают работать. В противном случае наш прокси не будет отдавать вам картинки.

Если наш прокси не устраивает, то можно развернуть свою копию, внеся изменения в настройки или даже код.

Разворачивание своей копии сервиса
----------

Необходимо установить [Docker](https://docs.docker.com/engine/install/ubuntu/) и [Docker Compose](https://docs.docker.com/compose/install/).

```
docker-compose build
docker-compose up
```

Кастомизация настроек
-------------

Большая часть настроек находится в файле <./config/default.json>. Эти настройки используются во всех вариантах запуска: и при запуске сервера для разработки, и при запуске юнит-тестов, и при запуске сервера в продакшен. 

Но поскольку в разных вариантах запуска нужны разные настройки, то лучше не вносить изменений в default.json, а переопределять настройки в одном из файлов:
- в файле <./config/production.json> - для запуска в продакшен. В большинстве случаев рекомендуется использовать именно этот файл.
- в файле <./config/test.json> - для юнит-тестов
- кроме того, [некоторые](/config/custom-environment-variables.json) параметры можно переопределить в переменных среды (например, в секции environment в docker-compose)

Есть также файл <./config/blacklist.json>, который хранит черные списки аккаунтов и URL изображений, которые необходимо запретить к вставке. Этот файл работает в любом из вариантов запуска.

Разработка (работа с кодом)
----------

Рекомендуемая ОС - Ubuntu 16.04 или новее.

Следует выполнить следующие команды для установки зависимостей:

```
sudo apt-get remove nodejs
curl -fsSL https://deb.nodesource.com/setup_14.x | sudo -E bash -
sudo apt-get install -y nodejs

npm install --global yarn

sudo apt-get install build-essential
```

Также для разработки необходимо запустить службу Tarantool. 
```
docker-compose build db
docker run -d -p 49003:49003 --name imageproxy-db golosblockchain/imageproxy:tarantool
```

Когда все готово, можно запускать сервер:

```
make devserver
```

Это установит все зависимости yarn и запустит сервер для разработки, который будет автоматически принимать все изменения, вносимые вами в код.

### Дополнительно

Для запуска линтера можно использовать команду `make lint`

Для юнит-тестов - команду `make test`.

При этом есть возможность запустить только определенные тесты: `grep='upload gif' make test` - запустит только тесты, содержащие в названии слова 'upload gif'. 

Для просмотра логов Tarantool в реальном времени:
```
docker logs --tail 10 -f imageproxy-db
```

Чтобы посмотреть, как лежат данные в Tarantool (с целью изучения, проверки и т.п.), можно использовать команду:
```
docker exec -it imageproxy-db tarantoolctl connect 49003
```
или в случае docker-compose:

*docker-compose exec db tarantoolctl connect 49003*

Для остановки и очистки Tarantool:
```
docker stop imageproxy-db
docker rm imageproxy-db
```

### Запуск в продакшен

Для запуска imageproxy на "боевом" сервере (а не для разработки) следует использовать docker-compose (см. выше) или [этот](https://github.com/golos-blockchain/ui-auth/blob/master/Dockerfile) Dockerfile.

API
---

Все запросы (кроме GET) имеют формат `multipart/form-data`. Все ответы являются изображениями или имеют формат объекта JSON.  
Работать с API лучше всего с помощью [XMLHttpRequest](https://developer.mozilla.org/ru/docs/Web/API/XMLHttpRequest) или любой сторонней библиотеки, которая способна отображать % загрузки больших изображений на сервер. Можно использовать и [fetch](https://developer.mozilla.org/ru/docs/Web/API/Fetch_API), но при загрузке файлов с компьютера или другого устройства не будет прогресс-бара загрузки.

В случае ошибки ответ имеет HTTP-статус >= 400. Ниже приведена примерная структура ответа с ошибкой:

```json
{
    "status": "err",
    "httpStatus": 403,
    "error": "account_blacklisted"
}
```

Все эти поля присутствуют у всех ответов с ошибками. Поле `"httpStatus"` равно тому же значению, что и HTTP-статус самого ответа. Поле `"error"` содержит идентификатор ошибки, полный список [здесь](/src/error.ts).

#### `GET /<width>x<height>/<image_url>` - простой способ проксировать изображение из Интернета.

Скачивает изображение по `image_url`, сохраняет его в базу данных сервиса и выдает в ответ. Можно вставлять эту ссылку в `<img>`. Если оригинальное изображение будет удалено или изменено, оно все равно будет доступно по этой ссылке благодаря базе данных.

`width` и `height` могут быть `0`, чтобы вставить изображение в оригинальном размере, или какое-то другое значение (в пикселях), чтобы изменить размер изображения. Пропорции при этом сохраняются, а само изменение размера делается максимально аккуратно. Изменение размера делается только в меньшую сторону.

**Примечание:** изображение автоматически преобразуется в WEBP. Если необходима поддержка очень старых браузеров, то этот способ не подходит.

**Данный метод требует того,** чтобы мы добавили ваш домен в свой белый список. Подробнее - в начале данного документа.

#### `GET /p/<b58_image_url>[?options]` - более гибкий способ.

Работает аналогично предыдущему способу. Эту ссылку также можно вставлять в `<img>`. Но дает больше возможностей.

**Данный метод требует того,** чтобы мы добавили ваш домен в свой белый список. Подробнее - в начале данного документа.

##### Параметры

  * `<b58_image_url>` - URL изображения, закодированный в [Base58](https://en.wikipedia.org/wiki/Base58) UTF-8 строку.

##### Опции запроса

Эти опции задаются как [Query-strings](https://en.wikipedia.org/wiki/Query_string), то есть после <b58_image_url> ставится "?", затем ключи и значения этих опций, где между ключом и значением ставится "=", а между значением и следующим ключом ставится "&". Ниже даны примеры запросов.

  * `width` - Желаемая ширина изображения в пикселях (или 0, чтобы не менять размер).
  * `height` - Желаемая высота в пикселях (или 0).
  * `mode` - Способ изменения размера изображения. Одно из значений:
    * `cover` - Отмасштабировать изображение точно под размеры width x height, а все, что не вписывается, обрезать.
    * `fit` - Отмасштабировать изображение, вписав его в прямоугольник width x height, сохраняя пропорции сторон и ничего не обрезая.
  * `format` - В какой формат преобразовать изображение. Одно из значений:
    * `jpeg` - JPEG. Работает в любых браузерах, идеально для фотографий, но портит качество рисунков.
    * `png` - PNG. Работает в любых браузерах, не портит качество, но неоптимально для фотографий.
    * `webp` - WebP. Идеален как для рисунков, так и фотографий. Превосходит JPEG и PNG по компактности. Не поддерживается в IE и Safari старше 15, разве что через полифилл.
    * `match` - Отдавать изображение без преобразования. **Важно:** Если используете этот вариант, то запретите пользователям загрузку TIFF, поскольку ни один браузер не отображает их. Кроме того, SVG иногда принудительно преобразовывается в PNG.

Все опции являются опциональными. `format` по умолчанию `match`. `mode` по умолчанию `cover`.

##### Ответ

Как уже сказано выше, ответом будет изображение, поэтому совместимо с `<img>`.

Кроме того, в ответе есть заголовок `X-URL`, что позволяет увидеть оригинальный URL изображения, правда, не через `<img>`, а с помощью вкладки Network в DevTools или с помощью XMLHttpRequest.

##### Примеры

Допустим, надо вставить такую картинку: https://i.imgur.com/Ijsd5oz.jpg 

Для этого необходимо преобразовать ее URL в строку base58. Сам прокси для работы с base58 использует библиотеку [multihashes](https://multiformats.github.io/js-multihash/), вы также можете использовать ее. Или [эту реализацию base58](https://github.com/golos-blockchain/imageproxy/tree/examples/base58-example-js), которая не требует NPM и работает даже в браузере Internet Explorer, старых версиях Safari и в Node.js старше 11.

Результат преобразования: `2bP4pJr4wVimqCWjYimXJe2cnCgn9hbGu2XUtXfijMp`

Делаем из этого ссылку:

https://devimages.golos.today/p/2bP4pJr4wVimqCWjYimXJe2cnCgn9hbGu2XUtXfijMp

Здесь изображение отдается в формате JPEG.

Конвертируем изображение в WEBP и уменьшаем под размеры 300x200px, обрезая все лишнее:
https://devimages.golos.today/p/2bP4pJr4wVimqCWjYimXJe2cnCgn9hbGu2XUtXfijMp?width=300&height=200&format=webp

Конвертируем изображение в PNG и уменьшаем его, вписываем в 300x200px, сохраняя пропорции:
https://devimages.golos.today/p/2bP4pJr4wVimqCWjYimXJe2cnCgn9hbGu2XUtXfijMp?width=300&height=200&format=jpeg&mode=fit

Можно указать и только один размер:
https://devimages.golos.today/p/2bP4pJr4wVimqCWjYimXJe2cnCgn9hbGu2XUtXfijMp?height=200&format=webp&mode=fit

#### `POST /@<username>/<signature>` - загрузка изображения с компьютера или другого устройства.

##### Параметры

  * `<username>` - имя аккаунта в Golos.
  * `<signature>` - подпись бинарных данных изображения с помощью posting-ключа или active-ключа данного аккаунта.

Формат запроса `multipart/form-data`. В теле запроса должна быть 1 секция, содержащая файл изображения (с Content-Type).

[Здесь](https://github.com/golos-blockchain/imageproxy/tree/examples/js-upload) пример подписи и загрузки файла, загруженного в `input type="file"`.

Возвращает JSON-объект, который содержит URL загруженного изображения, информацию об изображении (ширина и высота в пикселях, размер в байтах, формат), а также информацию о том, сколько еще изображений можно загрузить в ближайшее время (ratelimit).

#### `GET /<upload_key>` - ссылка на загруженное изображение.

Возвращает изображение. Получить ссылку можно при загрузке файла по маршруту, указанному выше, или из профиля пользователя.

Загруженные изображения также можно **проксировать**, меняя размер, преобразуя в другой формат и т.п., как и обычные изображения из интернета.

#### `GET /@<username>[?from=key&limit=...&detailed=true]` - профиль пользователя.

Возвращает список изображений, недавно загруженных данным пользователям (последние 20 изображений), а также информацию об его текущем ratelimit и о пагинации (ссылку на следующую страницу профиля, если изображений больше, чем `limit`).

##### Опции

* `from`, `limit` - пагинация.
* `detailed` - Если 1, то отображается также дополнительная информация по загруженным изображениям: дата и время их загрузки, ширина и высота в пикселях, размер в байтах, формат.

Все опции необязательны. `limit` по умолчанию 10.

#### `GET /who/<upload_key>[?from=key&limit=...&detailed=true]` - кто загружал данное изображение.

Возвращает список аккаунтов, загружавших изображение.

##### Опции

* `from`, `limit` - пагинация.
* `detailed` - Если 1, то отображается также дополнительная информация по загруженным изображениям: дата и время их загрузки каждым аккаунтом, ширина и высота в пикселях, размер в байтах, формат.

Все опции необязательны. `limit` по умолчанию 10.
