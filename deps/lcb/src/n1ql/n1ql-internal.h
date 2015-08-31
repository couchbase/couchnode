#ifndef LCB_N1QL_INTERNAL_H
#define LCB_N1QL_INTERNAL_H

#ifdef __cplusplus
#include <string>
extern "C" {
#endif

typedef struct lcb_N1QLCACHE_st lcb_N1QLCACHE;
lcb_N1QLCACHE *lcb_n1qlcache_create(void);
void lcb_n1qlcache_destroy(lcb_N1QLCACHE*);
void lcb_n1qlcache_clear(lcb_N1QLCACHE *);

#ifdef __cplusplus
void lcb_n1qlcache_getplan(lcb_N1QLCACHE *cache,
    const std::string& key, std::string& out);
}
#endif
#endif
