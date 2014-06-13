#ifndef LCB_MY_INTTYPES_H
#define LCB_MY_INTTYPES_H
#ifdef __cplusplus
#define __STDC_FORMAT_MACROS
#endif

#if __STDC_VERSION__ >= 199901L || __GNUC__
#include <inttypes.h>
#elif _MSC_VER
#ifndef PRIx64
#define PRIx64 "I64x"
#endif
#ifndef PRIX64
#define PRIX64 "I64x"
#endif

#ifndef PRIu64
#define PRIu64 "I64u"
#endif

#endif /* _MSC_VER */
#endif
