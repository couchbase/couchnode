#ifndef SRC_HASH_H_
#define SRC_HASH_H_ 1

#ifdef __cplusplus
extern "C" {
#endif

    cbsasl_uint32_t hash(const void *key, size_t length, const cbsasl_uint32_t initval);

#ifdef __cplusplus
}
#endif

#endif  /* SRC_HASH_H_ */
