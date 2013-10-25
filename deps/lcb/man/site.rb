#!/usr/bin/env ruby

# Generate HTML site from man page sources
#
# Prerequisites
#
#   * ruby interpreter (http://www.ruby-lang.org/en/downloads/)
#   * a2x (http://www.methods.co.nz/asciidoc/INSTALL.html)
#   * zip
#
# Usage:
#
#   ruby ./man/site.rb
#
# The command above should generate file matching this shell pattern:
#
#   ./man/libcouchbase*.zip

require 'fileutils'

FileUtils.chdir(File.dirname(__FILE__))

sources = Dir.glob("man[1-9]*/*[1-9]*.txt")
destdir = "libcouchbase"
version = `git describe --always`.chomp rescue nil
if version
  destdir << "-#{version}"
end
tempdir = "tmp"
FileUtils.mkdir_p(tempdir)
FileUtils.mkdir_p(destdir)

sources.each do |file|
  contents = File.read(file)
  STDERR.print("#{file} ... ")
  tmpname = "#{tempdir}/#{File.basename(file, ".txt")}.tmp"
  tmp = File.open(tmpname, "w")
  contents.gsub!(/(?<!=\s)(((libcouchbase|lcb|cbc)\w*)\((\d+\w*)\))/, 'link:\2.\4.html[\1]')
  tmp.write(contents)
  tmp.close
  output = `a2x -D #{destdir} -L --doctype manpage --format xhtml #{tmpname} 2>&1`
  if $?.success?
    STDERR.puts("OK")
  else
    STDERR.puts("FAIL")
    STDERR.puts(output)
    exit 1
  end
  File.unlink(tmpname)
end

FileUtils.cp("#{destdir}/libcouchbase.3lib.html", "#{destdir}/index.html")
File.open("#{destdir}/docbook-xsl.css", "a+") do |f|
  f.puts(<<EOS)
/* couchbase styles */
body{color:#5b5352;background:#fcfdfb;}
h1,h2,h3{color:#a30a0a;font-weight:bold;}
h4,h5,h6{font-weight:normal;}
h1{font-size:2.5em;line-height:1;margin-bottom:0.5em;}
h2{font-size:2em;margin-bottom:0.75em;}
h3{font-size:1.5em;line-height:1;margin-bottom:1em;}
h4{font-size:1.2em;line-height:1.25;margin-bottom:1.25em;}
h5{font-size:1em;font-weight:bold;margin-bottom:1.5em;}
h6{font-size:1em;font-weight:bold;}
h1 img,h2 img,h3 img,h4 img,h5 img,h6 img{margin:0;}
a,a:link,a:visited{color:#0a72a3;text-decoration:none;}
a:hover,a:active,a:focus{color:#a30a0a;text-decoration:underline;outline:none;}
hr{height:1px;background:#edede5;color:#edede5;border:none;}
dt span.term{color:#a30a0a;}
table,tbody,thead,table td, table tr{border:1px solid #c4c1be !important;}
body pre{color:#5c0000;font-size:90%;}
EOS
end

system("zip -9 -r #{File.basename(destdir)}.zip #{destdir}")
FileUtils.rm_rf(tempdir)
FileUtils.rm_rf(destdir)
