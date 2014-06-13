#ifndef LCB_SLIST_H
#define LCB_SLIST_H

struct slist_node_st;
typedef struct slist_node_st {
    struct slist_node_st *next;
} sllist_node;

typedef struct {
    sllist_node *first;
    sllist_node *last;
} sllist_root;

/**
 * Indicates whether the list is empty or not
 */
#define SLLIST_IS_EMPTY(list) ((list)->last == NULL)

#define SLLIST_IS_ONE(list) ((list)->first && (list)->first == (list)->last)

/**
 * Iterator for list. This can be used as the 'for' statement; as such this
 * macro should look like such:
 *
 *  slist_node *ii;
 *  SLIST_FOREACH(list, ii) {
 *      my_item *item = LCB_LIST_ITEM(my_item, ii, slnode);
 *  }
 *
 *  @param list the list to iterate
 *  @param pos a local variable to use as the iterator
 */
#define SLLIST_FOREACH(list, pos) \
    for (pos = (list)->first; pos; pos = pos->next)


typedef struct sllist_iterator_st {
    sllist_node *cur;
    sllist_node *prev;
    sllist_node *next;
    int removed;
} sllist_iterator;

#define sllist_iter_end(list, iter) ((iter)->cur == NULL)

#define SLLIST_ITEM(ptr, type, member) \
        ((type *) (void *) ((char *)(ptr) - offsetof(type, member)))

#define SLLIST_ITERFOR(list, iter) \
    for (slist_iter_init(list, iter); \
            !sllist_iter_end(list, iter); \
            slist_iter_incr(list, iter))

#define SLLIST_ITERBASIC(list, elem) \
        for (elem = (list)->first; elem; elem = elem->next)

#endif
