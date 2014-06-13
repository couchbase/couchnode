#ifndef LCBIO_H
#define LCBIO_H
#include "connect.h"
#include "manager.h"
#include "ioutils.h"
#include "ctx.h"
#endif

/**
 * @defgroup LCBIO I/O
 * @brief IO Core
 *
 * @details
 *
 * This module represents the I/O core of libcouchbase. Effort has been made
 * so that this module in theory is usable outside of libcouchbase.
 *
 * # Architectural Overview
 *
 * The I/O core (_LCBIO_) has been designed to support different I/O models and
 * operating environments, with the goal of being able to integrate natively
 * into such environments with minimal performance loss. Integration is acheived
 * through several layers. The first layer is the _IOPS_ system defined in
 * <libcouchbase/iops.h> and defines integration APIs for different I/O models.
 *
 * Afterwards, this is flattened and normalized into an _IO Table_ (`lcbio_TABLE`)
 * which serves as a context and abstraction layer for unifying those two APIs
 * where applicable.
 *
 * Finally the "End-user" APIs (in this case end-user means the application which
 * requests a TCP connection or I/O on a socket) employs the
 * `lcbio_connect` and `lcbio_CTX` systems to provide a uniform interface, the
 * end result being that the underlying I/O model is completely abstracted.
 */
