# vim: ft=python

import os
import os.path


def set_options(opt):
  opt.tool_options("compiler_cc")
  opt.tool_options("compiler_cxx")


couchnode_mods = [
    "couchbase"
]

lcb_luv_mods = [
    "common",
    "socket",
    "read",
    "write",
    "timer",
    "plugin-libuv",
    os.path.join("util", "lcb_luv_yolog"),
    os.path.join("util", "hexdump")
]

def configure(conf):
  conf.check_tool("compiler_cxx")
  conf.check_tool("compiler_cc")
  conf.check_tool("node_addon")

def build(bld):
  obj = bld.new_task_gen("cc", "cxx", "node_addon", "cshlib")
  obj.cxxflags = ["-g", "-Wall", "-pedantic", "-Wextra" ]
  obj.cppflags = obj.cxxflags
  obj.ldflags = ["-lcouchbase" ]
  obj.target = "couchbase"

  obj.source = [ os.path.join("src", mod) + ".cc" for mod in couchnode_mods ]
  obj.source += [ os.path.join("io", mod) + ".c" for mod in lcb_luv_mods ]
