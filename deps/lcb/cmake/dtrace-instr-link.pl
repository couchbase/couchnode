#!/usr/bin/env perl
use strict;
use warnings;
use Digest::MD5 qw(md5_hex);

my $HDR = "** $0:";
$\="\n";

my $DT_SRC = shift @ARGV;
my $CMD = shift @ARGV;

my @O_FILES = grep { $_ =~ /\.o$/ } @ARGV;
if (!scalar @O_FILES) {
    # Assume this isn't an actual link command?
    print"$HDR Assuming this isn't an LD/AR invocation. Continuing..";
    exec($CMD,@ARGV);
}

my $ss = join('_', @O_FILES);
my $hexstr = md5_hex($ss);

my $INSTRUMENTED = "generated/probes_${hexstr}.o";
# Run DTrace instrumentation. Assuming running from build directory:
my @args = (
    'dtrace', '-C', '-G',
    '-s', $DT_SRC,
    '-o', $INSTRUMENTED,
    @O_FILES);

print "$HDR: Creating instrumented DTrace object: @args";
if (system(@args) != 0) {
    exit(1);
}

unshift @ARGV, $CMD;
push @ARGV, $INSTRUMENTED;
print "$HDR: Linking with instrumented DTrace object: @ARGV";
exit(system(@ARGV));
