{
  'targets': [{
    'target_name': 'couchbase_impl',
    'conditions': [
      [ 'OS=="win"', {
        'variables': {
          'couchbase_root%': 'C:/couchbase'
        },
        'include_dirs': [
          '<(couchbase_root)/include/',
        ],
        'link_settings': {
          'libraries': [
            '-l<(couchbase_root)/lib/libcouchbase.lib',
          ],
        },
        'copies': [{
          'files': [ '<(couchbase_root)/lib/libcouchbase.dll' ],
          'destination': '<(module_root_dir)/build/Release/',
        },],
        'configurations': {
          'Release': {
            'msvs_settings': {
              'VCCLCompilerTool': {
                'ExceptionHandling': '2',
                'RuntimeLibrary': 0,
              },
            },
          },
        },
      }],
      ['OS=="mac"', {
        'xcode_settings': {
          'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
        },
      }],
      ['OS!="win"', {
        'link_settings': {
          'libraries': [
            '-lcouchbase',
          ],
        },
        'cflags': [
          '-g',
          '-fPIC',
          '-Wno-unused-variable',
          '-Wno-unused-function',
        ],
        'cflags!': [
          '-fno-exceptions',
        ],
        'cflags_cc!': [
          '-fno-exceptions',
        ],
      }],
    ],
    'sources': [
      'src/args.cc',
      'src/couchbase_impl.cc',
      'src/namemap.cc',
      'src/notify.cc',
      'src/operations.cc',
      'src/cas.cc',
      'io/common.c',
      'io/socket.c',
      'io/read.c',
      'io/write.c',
      'io/timer.c',
      'io/plugin-libuv.c',
      'io/util/lcb_luv_yolog.c',
      'io/util/hexdump.c',
    ],
    'include_dirs': [
      './',
    ],
  }]
}
