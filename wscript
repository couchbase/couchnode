def set_options(opt):
  opt.tool_options("compiler_cxx")

def configure(conf):
  conf.check_tool("compiler_cxx")
  conf.check_tool("node_addon")

def build(bld):
  obj = bld.new_task_gen("cxx", "shlib", "node_addon")
  obj.cxxflags = ["-g", "-Wall", "-Werror", "-pedantic", "-Wshadow", "-fdiagnostics-show-option", "-fno-strict-aliasing", "-Wno-strict-aliasing", "-Wextra", "-std=gnu++98", "-Woverloaded-virtual", "-Wnon-virtual-dtor", "-Wctor-dtor-privacy", "-Wno-long-long", "-Wno-redundant-decls" ]
  obj.ldflags = ["-lcouchbase"]
  obj.target = "couchbase"
  obj.source = "src/couchbase.cc"
