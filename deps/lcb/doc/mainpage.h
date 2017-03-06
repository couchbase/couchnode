/**
 *
 * @mainpage
 *
 * If you're new to this page, you may wish to read the @ref intro_sec first
 * to get started. If you're coming back here for reference, here are some
 * handy links to look at.
 *
 * * @subpage lcb-init
 * * @subpage lcb-kv-api
 * * @subpage lcb-cntl-settings
 *
 * You may read about related Couchbase software at http://docs.couchbase.com/
 *
 *
 * @section lcb_examples Examples
 *
 * * @ref example/minimal/minimal.c - Minimal example for connecting to a cluster
 *   and performing operations
 *
 * * @ref example/libeventdirect/main.c - Shows how to integrate with an external
 *   event library (libevent, in this case).
 *
 *
 * Some more extensive examples may be observed in the SDKs wrapping libcouchbase
 * to expose interfaces in their native languages.
 *
 * * Couchbase Python SDK (http://github.com/couchbase/couchbase-python-client).
 * * Couchbase node.js SDK (http://github.com/couchbase/couchnode)
 * * Couchbase Ruby SDK (http://github.com/couchbase/couchbase-ruby-client)
 *
 *
 * @section lcb_jira Reporting Issues
 *
 * If you think you've found an issue, please file a bug on
 * http://couchbase.com/issues. Select the _Couchbase C Client_ project. Before
 * filing an issue, search for existing issues to determine if your issue has
 * not yet been fixed in a newer version.
 *
 */

/**
 * @example example/minimal/minimal.c
 * Shows how to connect to the cluster and perform operations
 *
 * @example example/libeventdirect/main.c
 * Shows how to integrate the library with an external event loop
 */

/**
 * @internal
 * @defgroup lcb-public-api Public API
 * @brief Public API Routines
 * @details
 *
 * This covers the functions and structures of the library which are public
 * interfaces. These consist of functions decorated with `LIBCOUCHBASE_API`
 * and which are defined in the `libcouchbase` header directory.
 */

/**
 * @internal
 * @defgroup lcb-generics Generic Types
 * @brief Generic utilities and containers
 * @addtogroup lcb-generics
 * @{
 * @file src/list.h
 * @file src/sllist.h
 * @file src/sllist-inl.h
 * @file src/hostlist.h
 * @}
 *
 *
 * @defgroup lcb-clconfig Bucket/Cluster Configuration
 * @brief This module retrieves and processes cluster configurations from a
 * variety of sources
 * @addtogroup lcb-clconfig
 * @{
 * @file src/bucketconfig/clconfig.h
 * @}
 */


/**
 * @page lcb_thrsafe Thread Safety
 *
 * The library uses no internal locking and is thus not safe to be used
 * concurrently from multiple threads. As the library contains no globals
 * you may call into the library from multiple threads so long as the same data
 * structure (specifically, the same `lcb_t`) is not used.
 *
 * @include doc/example/threads.c
 *
 * In this quick mockup example, the same `lcb_t` is being used from multiple
 * threads and thus requires locking. Now if each thread created its own `lcb_t`
 * it would be free to operate upon it without locking.
 */
