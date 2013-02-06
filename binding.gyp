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
            '$(EXTRA_LDFLAGS)',
            '-lcouchbase',
          ],
        },
        'cflags': [
          '-g',
          '-fPIC',
          '-Wall',
          '-Wextra',
          '-Wno-unused-variable',
          '-Wno-unused-function',
          '$(EXTRA_CFLAGS)',
          '$(EXTRA_CPPFLAGS)',
          '$(EXTRA_CXXFLAGS)',
        ],
        'cflags_c':[
          '-pedantic',
          '-std=gnu99',
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
      'src/couchbase_impl.cc',
      'src/namemap.cc',
      'src/notify.cc',
      'src/operations.cc',
      'src/cas.cc',
      'src/ioplugin.cc'
    ],
    'include_dirs': [
      './',
    ],
  }]
}
