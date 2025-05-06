// next-i18next.config.js
module.exports = {
    i18n: {
        defaultLocale: 'en',
        locales: ['en', 'fr'],
    },
    reloadOnPrerender: process.env.NODE_ENV === 'development',
};
