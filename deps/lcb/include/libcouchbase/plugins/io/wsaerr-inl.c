#include "wsaerr.h"

static int
wsaerr_map_impl(DWORD in)
{
    switch (in) {
    case WSAECONNRESET:
        return ECONNRESET;

    case WSAECONNABORTED:
    case WSA_OPERATION_ABORTED:
        return ECONNABORTED;

    case WSA_NOT_ENOUGH_MEMORY:
        return ENOMEM;

    case WSAEWOULDBLOCK:
    case WSA_IO_PENDING:
        return EWOULDBLOCK;

    case WSAEINVAL:
        return EINVAL;

    case WSAEINPROGRESS:
        return EINPROGRESS;

    case WSAEALREADY:
        return EALREADY;

    case WSAEISCONN:
        return EISCONN;

    case WSAENOTCONN:
    case WSAESHUTDOWN:
        return ENOTCONN;

    case WSAECONNREFUSED:
        return ECONNREFUSED;

    case WSAEINTR:
        return EINTR;


    case WSAENETDOWN:
    case WSAENETUNREACH:
    case WSAEHOSTUNREACH:
    case WSAEHOSTDOWN:
        return ENETUNREACH;

    case WSAETIMEDOUT:
        return ETIMEDOUT;

    case WSAENOTSOCK:
        return ENOTSOCK;

    default:
        return EINVAL;
    }
}
