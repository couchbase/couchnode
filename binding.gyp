{
  'targets': [{
    'target_name': 'couchbase_impl',
    'variables': {
      'couchbase_root%': ''
    },
    'defines': [
      'LCBUV_EMBEDDED_SOURCE'
    ],
    'conditions': [
      [ 'couchbase_root==""', {
        'defines': [
          'LIBCOUCHBASE_STATIC'
        ],
        'dependencies': [
          'deps/lcb/libcouchbase.gyp:couchbase'
        ]
      }, {
        'conditions': [
          [ 'OS=="win"', {
            'include_dirs': [
              '<(couchbase_root)/include/'
            ],
            'link_settings': {
              'libraries': [
                '-l<(couchbase_root)/lib/libcouchbase.lib'
              ]
            },
            'copies': [
              {
                'files': [ '<(couchbase_root)/bin/libcouchbase.dll' ],
                'destination': '<(module_root_dir)/build/Release/'
              },{
                'files': [ '<(couchbase_root)/bin/libcouchbase.dll' ],
                'destination': '<(module_root_dir)/build/Debug/'
              }
            ],
          }, {
            'link_settings': {
              'libraries': [
                '-lcouchbase',
              ],
            },
            'include_dirs': [ '<(couchbase_root)/include' ],
            'libraries+': [ '-L<(couchbase_root)/lib' ],
            'conditions': [ [ 'OS!="mac"', {'libraries+':['-Wl,-rpath=<(couchbase_root)/lib']} ] ]
          }]
        ]
      }],
      [ 'OS=="win"', {
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
            '$(EXTRA_LDFLAGS)'
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
        ]
      }]
    ],
    'sources': [
      'src/couchbase_impl.cc',
      'src/control.cc',
      'src/constants.cc',
      'src/namemap.cc',
      'src/cookie.cc',
      'src/commandbase.cc',
      'src/commands.cc',
      'src/exception.cc',
      'src/options.cc',
      'src/cas.cc',
      'src/uv-plugin-all.c',
      'src/valueformat.cc'
    ],
    'include_dirs': [
      '<!(node -e "require(\'nan\')")',
      './',
      './src/io'
    ]
  }]
}
