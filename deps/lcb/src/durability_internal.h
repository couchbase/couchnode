#ifndef LCB_DURABILITY_INTERNAL_H
#define LCB_DURABILITY_INTERNAL_H

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
        lcb_list_t ll;

        /** Request for this structure */
        struct lcb_durability_cmd_st request;

        /** result for this entry */
        struct lcb_durability_resp_st result;

        /** pointer to the containing durability_set */
        struct lcb_durability_set_st *parent;

        /**
         * flag, indicates that we're done and that it should be excluded from
         * further operations
         */
        unsigned char done;
    } lcb_durability_entry_t;

    /**
     * A collection encompassing one or more keys which are to be checked for
     * persistence
     */
    typedef struct lcb_durability_set_st {
        /** options */
        struct lcb_durability_opts_st opts;

        /** array of entries which are to be polled */
        struct lcb_durability_entry_st *entries;

        /** Allocated as well for passing to observe_ex */
        struct lcb_durability_entry_st **valid_entries;

        /** number of entries in the array */
        lcb_size_t nentries;

        struct {
            /**
             * Tweak for single entry, so we don't have to allocate tiny chunks
             */
            lcb_durability_entry_t ent;
            lcb_durability_entry_t *entp;
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
         * User cookie
         */
        const void *cookie;

        /**
         * Timestamp for the timeout
         */
        lcb_uint32_t us_timeout;

        void *timer;

        lcb_t instance;
    } lcb_durability_set_t;

    void lcb_durability_update(lcb_t instance,
                               const void *cookie,
                               lcb_error_t err,
                               lcb_observe_resp_t *resp);

    void lcb_durability_dset_update(lcb_t instance,
                                    lcb_durability_set_t *dset,
                                    lcb_error_t err,
                                    const lcb_observe_resp_t *resp);

#ifdef __cplusplus
}
#endif

#endif
