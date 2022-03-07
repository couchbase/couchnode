{
    'targets': [{
        'target_name': 'couchbase_impl',
        'variables': {
            'couchbase_root%': ''
        },
        'defines': [
            'LCBUV_EMBEDDED_SOURCE',
            'LCB_TRACING'
        ],
        'conditions': [
            ['couchbase_root==""', {
                'defines': [
                    'LIBCOUCHBASE_STATIC'
                ],
                'dependencies': [
                    'deps/lcb/libcouchbase.gyp:couchbase'
                ]
            }, {
                'conditions': [
                    ['OS=="win"', {
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
                                'files': ['<(couchbase_root)/bin/libcouchbase.dll'],
                                'destination': '<(module_root_dir)/build/Release/'
                            }, {
                                'files': ['<(couchbase_root)/bin/libcouchbase.dll'],
                                'destination': '<(module_root_dir)/build/Debug/'
                            }
                        ],
                    }, {
                        'link_settings': {
                            'libraries': [
                                '-lcouchbase',
                            ],
                        },
                        'include_dirs': ['<(couchbase_root)/include'],
                        'libraries+': ['-L<(couchbase_root)/lib'],
                        'conditions': [['OS!="mac"', {'libraries+': ['-Wl,-rpath=<(couchbase_root)/lib']}]]
                    }]
                ]
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
                    '$(EXTRA_CFLAGS)',
                    '$(EXTRA_CPPFLAGS)',
                    '$(EXTRA_CXXFLAGS)',
                ],
                'cflags_c':[
                    '-pedantic',
                    '-std=gnu99',
                ]
            }],
            ['OS=="linux"', {
                "libraries": [
                    '-static-libgcc -static-libstdc++',
                ]
            }]
        ],
        'sources': [
            'src/addondata.cpp',
            'src/binding.cpp',
            'src/cas.cpp',
            'src/connection_ops.cpp',
            'src/connection.cpp',
            'src/constants.cpp',
            'src/error.cpp',
            'src/instance.cpp',
            'src/instance_callbacks.cpp',
            'src/lcbx.cpp',
            'src/logger.cpp',
            'src/metrics.cpp',
            'src/mutationtoken.cpp',
            'src/opbuilder.cpp',
            'src/respreader.cpp',
            'src/tracing.cpp',
            'src/uv-plugin-all.cpp'
        ],
        'include_dirs': [
            '<!(node -e "require(\'nan\')")'
        ]
    }]
}
