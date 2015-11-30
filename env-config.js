var envConfig = {};
envConfig.isCI = process.env.CONTINUOUS_INTEGRATION === 'true';
envConfig.runCoverage = process.env.COVERAGE === 'true' || envConfig.isCI;
envConfig.devBrowser = process.env.PHANTOM ? 'PhantomJS' : 'Chrome';
module.exports = envConfig;
