// Copyright (c) https://github.com/duyet/koa-isbot/blob/master/index.js
module.exports = function() {
    const BOTS = [
        "\\+https:\\/\\/developers.google.com\\/\\+\\/web\\/snippet\\/",
        "googlebot",
        "baiduspider",
        "gurujibot",
        "yandexbot",
        "slurp",
        "msnbot",
        "bingbot",
        "facebookexternalhit",
        "linkedinbot",
        "twitterbot",
        "slackbot",
        "telegrambot",
        "applebot",
        "pingdom",
        "tumblr ",
    ];

    const IS_BOT_REGEXP = new RegExp("^.*(" + BOTS.join("|") + ").*$");

    return async (ctx, next) => {
        var source = ctx.request.headers["user-agent"] || "unknown";

        var isBot = IS_BOT_REGEXP.exec(source.toLowerCase());
        if (isBot) {
            isBot = isBot[1];
        }

        ctx.isBot = isBot;
        await next();
    };
};
