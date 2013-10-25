/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 * This file is just a wrapper file used to include the gtest-all.cc located
 * under $GTEST_ROOT. Ideally I would have liked to put it in Makefile.am, but
 * then automake started to complain about missing files if we _didn't_ have
 * GTEST_ROOT defined (even if we didn't need to compile the file etc).
 */
#include "src/gtest-all.cc"
