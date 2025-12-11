# Quick Start

The simplest way to enable logging is to set the `CNLOGLEVEL` environment variable:

```console
CNLOGLEVEL=info node your-app.js
```

This will output SDK logs at INFO level and above (info, warn, error) to the console.

> NOTE: This is separate from the underlying C++ core console logger that is created with the `CBPPLOGLEVEL` environment variable. Integration of the core logger will be implemented in a future version of the SDK.

# Environment Variable Configuration

The SDK automatically checks the `CNLOGLEVEL` environment variable when connecting to a cluster. If set to a valid log level and no logger is explicitly provided, the SDK will create a console logger at the specified level.

### Valid Values

The following values are accepted (case-insensitive):

- `trace` - Most verbose, logs everything
- `debug` - Detailed debugging information
- `info` - General informational messages
- `warn` - Warning messages and above
- `error` - Error messages only (least verbose)

Invalid values will be ignored, and the SDK will default to no logging.

# Log Levels

The SDK uses five standard log levels in ascending order of severity:

| Level | Value | Description              | When to Use                         |
| ----- | ----- | ------------------------ | ----------------------------------- |
| TRACE | 0     | Finest-grained debugging | Tracing code execution paths        |
| DEBUG | 1     | Detailed debugging info  | Debugging application issues        |
| INFO  | 2     | Informational messages   | Tracking application progress       |
| WARN  | 3     | Warning messages         | Potentially harmful situations      |
| ERROR | 4     | Error messages           | Errors allowing continued execution |

# Programmatic Console Logger

You can create a console logger programmatically using the `createConsoleLogger()` function.

## Basic Usage

### TypeScript:

```TypeScript
import { connect, createConsoleLogger, LogLevel } from 'couchbase'

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: createConsoleLogger(LogLevel.INFO)
})
```

### JavaScript:

```JavaScript
const couchbase = require('couchbase')

const cluster = await couchbase.connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: couchbase.createConsoleLogger(couchbase.LogLevel.INFO)
})
```

## Logging Prefix

Add a prefix to all log messages for easier identification:

```TypeScript
import { connect, createConsoleLogger, LogLevel } from 'couchbase'

const logger = createConsoleLogger(LogLevel.DEBUG, '[Couchbase]')

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})

logger.info('Connection established!')
```

Output:

```console
[Couchbase] Connection established!
```

# Custom Logger Integration

The SDK uses a simple logging interface that makes it easy to integrate with popular logging libraries.

## Logger Interface

```TypeScript
interface Logger {
  trace?(message: string, ...args: any[]): void
  debug?(message: string, ...args: any[]): void
  info?(message: string, ...args: any[]): void
  warn?(message: string, ...args: any[]): void
  error?(message: string, ...args: any[]): void
}
```

All methods are optional. The SDK safely handles loggers that only implement a subset of methods.

## Simple Custom Logger

### TypeScript:
```TypeScript
class CustomLogger implements Logger {
  trace(msg: string, ...args: any[]): void {
    console.log('[TRACE]', msg, ...args)
  }

  debug(msg: string, ...args: any[]): void {
    console.log('[DEBUG]', msg, ...args)
  }

  info(msg: string, ...args: any[]): void {
    console.log('[INFO]', msg, ...args)
  }

  warn(msg: string, ...args: any[]): void {
    console.warn('[WARN]', msg, ...args)
  }

  error(msg: string, ...args: any[]): void {
    console.error('[ERROR]', msg, ...args)
  }
}

customLogger = new CustomLogger()

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: customLogger
})
```
### JavaScript:
```JavaScript
const customLogger = {
    trace: (msg, ...args) => console.log('[TRACE]', msg, ...args),
    debug: (msg, ...args) => console.log('[DEBUG]', msg, ...args),
    info: (msg, ...args) => console.log('[INFO]', msg, ...args),
    warn: (msg, ...args) => console.warn('[WARN]', msg, ...args),
    error: (msg, ...args) => console.error('[ERROR]', msg, ...args)
}

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: customLogger
})
```

## Integration with Pino

[Pino](https://github.com/pinojs/pino) is a fast, low-overhead logging library (`npm install pino`). Its API naturally matches the Couchbase Logger interface.

### Basic Integration

```TypeScript
import pino from 'pino'
import { connect } from 'couchbase'

const logger = pino({ level: 'info' })

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})
```

### With Custom Configuration

```TypeScript
import pino from 'pino'
import { connect } from 'couchbase'

const logger = pino({
  level: 'debug',
  formatters: {
    level: (label) => {
      return { level: label }
    }
  },
  transport: {
    target: 'pino-pretty', // need the pino-pretty package
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  }
})

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})
```

### Child Logger with Context

```TypeScript
import pino from 'pino'
import { connect } from 'couchbase'

const baseLogger = pino({ level: 'info' })
const couchbaseLogger = baseLogger.child({ component: 'couchbase' })

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: couchbaseLogger
})
```

## Integration with Winston

[Winston](https://github.com/winstonjs/winston) is a versatile logging library with support for multiple transports (`npm install winston`). Its API also matches the Couchbase Logger interface.

### Basic Integration

```TypeScript
import winston from 'winston'
import { connect } from 'couchbase'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
})

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})
```

### With Multiple Transports

```TypeScript
import winston from 'winston'
import { connect } from 'couchbase'

const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // Write all logs to console
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Write all logs to a file
    new winston.transports.File({
      filename: 'couchbase.log',
      level: 'info'
    }),
    // Write error logs to a separate file
    new winston.transports.File({
      filename: 'couchbase-error.log',
      level: 'error'
    })
  ]
})

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})
```

## Integration with Debug Package

The [debug](https://www.npmjs.com/package/debug) package uses a different API pattern, but you can create a simple adapter.

### Basic Integration

```TypeScript
import createDebug from 'debug'
import { connect, Logger } from 'couchbase'

const debugLogger = createDebug('couchbase')

// Create an adapter that implements the Logger interface
class CustomLogger implements Logger {
  trace(msg: string, ...args: any[]): void {
    debugLogger('[TRACE]', msg, ...args)
  }

  debug(msg: string, ...args: any[]): void {
    debugLogger('[DEBUG]', msg, ...args)
  }

  info(msg: string, ...args: any[]): void {
    debugLogger('[INFO]', msg, ...args)
  }

  warn(msg: string, ...args: any[]): void {
    debugLogger('[WARN]', msg, ...args)
  }

  error(msg: string, ...args: any[]): void {
    debugLogger('[ERROR]', msg, ...args)
  }
}

const logger = new CustomLogger()

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})
```

To enable debug output, set the `DEBUG` environment variable:

```console
DEBUG=couchbase node your-app.js
```

### With Separate Debug Instances per Level

```TypeScript
import createDebug from 'debug'
import { connect, Logger } from 'couchbase'

// Create separate debug instances for each log level
const debugTrace = createDebug('couchbase:trace')
const debugDebug = createDebug('couchbase:debug')
const debugInfo = createDebug('couchbase:info')
const debugWarn = createDebug('couchbase:warn')
const debugError = createDebug('couchbase:error')

class CustomLogger implements Logger {
  trace(msg: string, ...args: any[]): void {
    debugTrace(msg, ...args)
  }

  debug(msg: string, ...args: any[]): void {
    debugDebug(msg, ...args)
  }

  info(msg: string, ...args: any[]): void {
    debugInfo(msg, ...args)
  }

  warn(msg: string, ...args: any[]): void {
    debugWarn(msg, ...args)
  }

  error(msg: string, ...args: any[]): void {
    debugError(msg, ...args)
  }
}

const logger = new CustomLogger()

const cluster = await connect('couchbase://localhost', {
  username: 'Administrator',
  password: 'password',
  logger: logger
})
```

Enable specific log levels with wildcards:

```console
# Only errors and warnings
DEBUG=couchbase:error,couchbase:warn node your-app.js

# All levels
DEBUG=couchbase:* node your-app.js

# Everything except trace
DEBUG=couchbase:*,-couchbase:trace node your-app.js
```
