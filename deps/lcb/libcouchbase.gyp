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
      'gyp_config/common',
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

    # libcjson
    {
      'target_name': 'cjson',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/libvbucket/cJSON.c'
      ]
    },

    # libvbucket
    {
      'target_name': 'vbucket',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/libvbucket/crc32.c',
        'contrib/libvbucket/ketama.c',
        'include/libvbucket/vbucket.h',
        'include/libvbucket/visibility.h',
        'contrib/libvbucket/hash.h',
        'contrib/libvbucket/vbucket.c'
      ],
      'dependencies': [
        'cjson'
      ]
    },

    #libcouchbase_utils
    {
      'target_name': 'couchbase_utils',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/http_parser/http_parser.c',
        'src/base64.c',
        'src/gethrtime.c',
        'src/genhash.c',
        'src/hashtable.c',
        'src/hashset.c',
        'src/hostlist.c',
        'src/list.c',
        'src/logging.c',
        'src/packetutils.c',
        'src/ringbuffer.c',
        'src/simplestring.c',
        'src/url_encoding.c'
      ],
      'dependencies': [
        'cjson'
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
        'plugins/io/select/plugin-select.c',
        'src/arithmetic.c',
        'src/bconf_provider.c',
        'src/bootstrap.c',
        'src/bucketconfig/bc_cccp.c',
        'src/bucketconfig/bc_http.c',
        'src/bucketconfig/bc_file.c',
        'src/bucketconfig/confmon.c',
        'src/cntl.c',
        'src/compat.c',
        'src/connmgr.c',
        'src/durability.c',
        'src/error.c',
        'src/flush.c',
        'src/get.c',
        'src/handler.c',
        'src/http.c',
        'src/http_io.c',
        'src/http_parse.c',
        'src/instance.c',
        'src/connect.c',
        'src/connection_utils.c',
        'src/readwrite.c',
        'src/iofactory.c',
        'src/observe.c',
        'src/packet.c',
        'src/remove.c',
        'src/sanitycheck.c',
        'src/server.c',
        'src/server_negotiate.c',
        'src/server_io.c',
        'src/server_parse.c',
        'src/stats.c',
        'src/store.c',
        'src/synchandler.c',
        'src/timer.c',
        'src/timings.c',
        'src/touch.c',
        'src/utilities.c',
        'src/verbosity.c',
        'src/wait.c',
      ],
      'dependencies': [
        'couchbase_utils',
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
          'gyp_config/common',
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