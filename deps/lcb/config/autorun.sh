#!/bin/sh

set -e
./config/gensrclist.pl
cat > m4/version.m4 <<EOF
m4_define([VERSION_NUMBER], [`git describe | tr '-' '_'`])
m4_define([GIT_DESCRIBE], [`git describe --long`])
m4_define([GIT_CHANGESET],[`git rev-parse HEAD`])
EOF

autoreconf -i --force
