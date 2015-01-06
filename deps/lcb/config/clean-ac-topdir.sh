#!/bin/sh
set -x
rm -vf Makefile.am configure m4 Makefile.in configure.ac Makefile
rm -vf config.status config.log
rm -vf *.la
rm -vf libtool
rm -vfr autom4te.cache
rm -vf aclocal.m4
