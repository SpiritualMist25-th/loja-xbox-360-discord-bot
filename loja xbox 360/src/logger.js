const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const minLevel = LEVELS[process.env.LOG_LEVEL] || LEVELS.info;

function timestamp() {
    return new Date().toISOString();
}

function write(level, args) {
    if (LEVELS[level] < minLevel) return;
    const out = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    out(`[${timestamp()}] [${level.toUpperCase()}]`, ...args);
}

module.exports = {
    debug: (...args) => write('debug', args),
    info: (...args) => write('info', args),
    warn: (...args) => write('warn', args),
    error: (...args) => write('error', args),
};
