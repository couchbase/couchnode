#ifndef LCB_DURABILITY_INTERNAL_H
#define LCB_DURABILITY_INTERNAL_H

#include "simplestring.h"
#ifdef __cplusplus
extern "C" {
#endif

    /**
     * Here is the internal API for the durability functions.
     *
     * Durability works on polling multiple observe responses and waiting until a
     * key (or set of keys) have either been persisted, or the wait period has
     * expired.
     *
     * We maintain two types of command counters; one is a per-iteration counter
     * which says how many outstanding observe responses we need - this helps us
     * ensure we don't prematurely terminate the command before all the responses
     * are in.
     *
     * The second is a remaining counter; this counts how many keys do not have a
     * conclusive observe response yet (i.e. how many do not have their criteria
     * satisfied yet).
     */

    /**
     * Information a single entry in a durability set
     */
    typedef struct lcb_durability_entry_st {
        lcb_KEYBUF hashkey;
        lcb_U64 reqcas;

        /** result for this entry */
        lcb_RESPENDURE result;

        /** pointer to the containing durability_set */
        struct lcb_durability_set_st *parent;

        /**
         * flag, indicates that we're done and that it should be excluded from
         * further operations
         */
        unsigned char done;
    } lcb_DURITEM;

    /**
     * A collection encompassing one or more keys which are to be checked for
     * persistence
     */
    typedef struct lcb_durability_set_st {
        lcb_MULTICMD_CTX mctx;

        /** options */
        struct lcb_durability_opts_st opts;

        /** array of entries which are to be polled */
        struct lcb_durability_entry_st *entries;

        /** number of entries in the array */
        lcb_size_t nentries;
        lcb_size_t ents_alloced; /* How many of those were allocated */

        struct {
            /**
             * Tweak for single entry, so we don't have to allocate tiny chunks
             */
            lcb_DURITEM ent;
        } single;

        /**
         * How many entries have been thus far completed. The operation is
         * complete when this number hits zero
         */
        lcb_size_t nremaining;

        /**
         * How many entries remain for the current iteration
         */
        unsigned waiting;

        /**
         * Reference count. Primarily used if we're waiting on an event
         */
        unsigned refcnt;

        /**
         * State. This is defined in the source file
         */
        unsigned next_state;

        /**
         * Hash table. Only used for multiple entries
         */
        genhash_t *ht;

        /**
         * Buffer for key data
         */
        lcb_string kvbufs;

        /**
         * User cookie
         */
        const void *cookie;

        /**
         * Timestamp for the timeout
         */
        lcb_uint32_t us_timeout;

        void *timer;

        lcb_t instance;
    } lcb_DURSET;

    void lcb_durability_dset_update(lcb_t instance,
                                    lcb_DURSET *dset,
                                    lcb_error_t err,
                                    const lcb_RESPOBSERVE *resp);
    lcb_MULTICMD_CTX *
    lcb_observe_ctx_dur_new(lcb_t instance);

#ifdef __cplusplus
}
#endif

#endif
