#ifndef LCB_ENVVARS_H
#define LCB_ENVVARS_H

/**
 * @file
 * Environment variables for libcouchbase
 */

/**
 * @ingroup LCB_PUBAPI
 * @defgroup LCB_ENV Environment Variables
 *
 * These environment variables may be adjusted to modify the behavior of the
 * library.
 *
 *
 * @addtogroup LCB_ENV
 * @{
 */

/**
 * @showinitializer
 * @brief Disable CCCP transport
 * @see lcb_create_st2::transports
 */
#define LCB_ENVVAR_NO_CCCP "LCB_NO_CCCP"

/**
 * @showinitializer
 * @brief Disable HTTP transport
 * @see lcb_create_st2::transports
 */
#define LCB_ENVVAR_NO_HTTP "LCB_NO_HTTP"


/**
 * @showinitializer
 * @brief Print verbose information about I/O plugin loading
 * @see lcb_create_io_ops()
 */
#define LCB_ENVVAR_DLOPEN_DEBUG "LIBCOUCHBASE_DLOPEN_DEBUG"

/**
 * @showinitializer
 * @brief Enable console logger and set the verbosity level
 * @see lcb_logprocs
 * @see LCB_CNTL_LOGGER
 */
#define LCB_ENVVAR_LOGLEVEL "LCB_LOGLEVEL"

/**
 * @showinitializer
 * @brief Modify the default IOPS plugin to use.
 * This should be either a path to a loadable object _OR_ a name of a builtin
 * plugin. The following names are recognized
 *
 * * `libevent` (POSIX only)
 * * `select`
 * * `iocp` (Windows only)
 * * `libev` (POSIX only)
 * * `libuv`
 *
 * @see lcb_create_io_ops()
 */
#define LCB_ENVVAR_IOPS_NAME "LIBCOUCHBASE_EVENT_PLUGIN_NAME"

/**
 * @showinitializer
 *
 * If @ref LCB_ENVVAR_IOPS_NAME is _not_ a default plugin, but rather a loadable
 * object, this controls the symbol to search for which will act as the initializer.
 */
#define LCB_ENVVAR_IOPS_SYM "LIBCOUCHBASE_EVENT_PLUGIN_SYMBOL"


/**@}*/

#endif
