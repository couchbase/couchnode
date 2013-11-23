{
  'variables': { 'target_arch%': 'ia32' }, # default for node v0.6.x

  'target_defaults': {
    'default_configuration': 'Debug',
    'configurations': {
      'Debug': {
        'defines': [ 'DEBUG', '_DEBUG' ],
        'msvs_settings': {
          'VCCLCompilerTool': {
            'RuntimeLibrary': 1, # static debug
          },
        },
      },
      'Release': {
        'defines': [ 'NDEBUG' ],
        'msvs_settings': {
          'VCCLCompilerTool': {
            'RuntimeLibrary': 0, # static release
          },
        },
      }
    },
    'msvs_settings': {
      'VCLinkerTool': {
        'GenerateDebugInformation': 'true',
      },
    },

    'defines': [
      'LIBCOUCHBASE_INTERNAL=1',
      'LCB_LIBDIR=""'
    ],

    'include_dirs': [
      'include',
      'src',
      'contrib',
      'contrib/cbsasl/include',
      'gyp_config/<(OS)/<(target_arch)'
    ],

    'conditions': [
      ['OS=="win"', {
        'include_dirs': [
          './',
          'win32'
        ],
        "link_settings": {
          "libraries": [
            "-lws2_32.lib"
          ]
        }
      }],
    ]
  },

  'targets': [
    # libcbsasl
    {
      'target_name': 'cbsasl',
      'product_prefix': 'lib',
      'type': 'static_library',
      'defines': [
        'BUILDING_CBSASL'
      ],
      'sources': [
         'contrib/cbsasl/include/cbsasl/cbsasl.h',
         'contrib/cbsasl/include/cbsasl/visibility.h',
         'contrib/cbsasl/src/client.c',
         'contrib/cbsasl/src/common.c',
         'contrib/cbsasl/src/config.h',
         'contrib/cbsasl/src/cram-md5/hmac.c',
         'contrib/cbsasl/src/cram-md5/hmac.h',
         'contrib/cbsasl/src/cram-md5/md5.c',
         'contrib/cbsasl/src/cram-md5/md5.h',
         'contrib/cbsasl/src/util.h'
      ]
    },

    # libhttpparser
    {
      'target_name': 'httpparser',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/http_parser/http_parser.c',
        'contrib/http_parser/http_parser.h'
      ]
    },

    #libcrc32
    {
      'target_name': 'crc32',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/libvbucket/crc32.c'
      ]
    },

    #libketama
    {
      'target_name': 'ketama',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/libvbucket/ketama.c'
      ]
    },

    # libvbucket
    {
      'target_name': 'vbucket',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'include/libvbucket/vbucket.h',
        'include/libvbucket/visibility.h',
        'contrib/libvbucket/hash.h',
        'contrib/libvbucket/cJSON.c',
        'contrib/libvbucket/cJSON.h',
        'contrib/libvbucket/vbucket.c'
      ],
      'dependencies': [
        'ketama',
        'crc32'
      ]
    },

    #libcouchbase
    {
      'target_name': 'couchbase',
      'product_prefix': 'lib',
      'type': 'static_library',
      'defines': [
        'CBSASL_STATIC'
      ],
      'include_dirs': [
        './'
      ],
      'sources': [
        'include/ep-engine/command_ids.h',
        'include/memcached/protocol_binary.h',
        'include/memcached/vbucket.h',
        'plugins/io/select/plugin-select.c',
        'plugins/io/select/select_io_opts.h',
        'src/arithmetic.c',
        'src/base64.c',
        'src/bconf_io.c',
        'src/bconf_parse.c',
        'src/bconf_provider.c',
        'src/cntl.c',
        'src/compat.c',
        'src/config_cache.c',
        'src/config_static.h',
        'src/connect.c',
        'src/cookie.c',
        'src/durability.c',
        'src/durability_internal.h',
        'src/error.c',
        'src/flush.c',
        'src/genhash.c',
        'src/genhash.h',
        'src/get.c',
        'src/gethrtime.c',
        'src/handler.c',
        'src/handler.h',
        'src/hashset.c',
        'src/hashset.h',
        'src/hashtable.c',
        'src/http.c',
        'src/http_io.c',
        'src/http_parse.c',
        'src/instance.c',
        'src/internal.h',
        'src/iofactory.c',
        'src/lcbio.h',
        'src/list.c',
        'src/list.h',
        'src/observe.c',
        'src/packet.c',
        'src/readwrite.c',
        'src/remove.c',
        'src/ringbuffer.c',
        'src/ringbuffer.h',
        'src/sanitycheck.c',
        'src/server.c',
        'src/server_connect.c',
        'src/server_io.c',
        'src/server_parse.c',
        'src/stats.c',
        'src/store.c',
        'src/strerror.c',
        'src/synchandler.c',
        'src/timer.c',
        'src/timings.c',
        'src/touch.c',
        'src/trace.h',
        'src/url_encoding.c',
        'src/url_encoding.h',
        'src/utilities.c',
        'src/verbosity.c',
        'src/wait.c'
      ],
      'dependencies': [
        'httpparser',
        'vbucket',
        'cbsasl'
      ],
      'copies': [{
        'files': [ 'plugins/io/libuv/libuv_io_opts.h' ],
        'destination': 'include/libcouchbase/',
      }, {
        'files': [
          'plugins/io/libuv/plugin-libuv.c',
          'plugins/io/libuv/plugin-internal.h',
          'plugins/io/libuv/libuv_compat.h'
        ],
        'destination': 'include/libcouchbase/plugins/io/libuv/'
      }],
      'direct_dependent_settings': {
        'include_dirs': [
          'include',
          './',
          'gyp_config/<(OS)/<(target_arch)'
        ],
      },
      'conditions': [
        ['OS=="win"', {
          'sources': [
             'plugins/io/iocp/iocp_iops.c',
             'plugins/io/iocp/iocp_iops.h',
             'plugins/io/iocp/iocp_loop.c',
             'plugins/io/iocp/iocp_timer.c',
             'plugins/io/iocp/iocp_util.c'
          ],
          'direct_dependent_settings': {
            'include_dirs': [
              'plugins/io/libuv'
            ],
          },
        }],
      ]
    }
  ]
}