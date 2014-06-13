#!/bin/sh
(
cat Doxyfile;
cat <<EOF
INPUT += src/rdb/ src/lcbio/ src/netbuf/ src/mc/ src/retryq.h src/bucketconfig/clconfig.h
INPUT += src/mcserver/ src/simplestring.h src/genhash.h src/list.h src/sllist.h
INPUT += src/sllist-inl.h src/hostlist.h src/bucketconfig/clconfig.h
INPUT += include/memcached/protocol_binary.h
INTERNAL_DOCS=yes
EOF
) | doxygen -
