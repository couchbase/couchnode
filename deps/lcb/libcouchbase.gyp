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
        'contrib/cJSON/cJSON.c'
      ]
    },

    # libvbucket
    {
      'target_name': 'vbucket',
      'product_prefix': 'lib',
      'type': 'static_library',
      'include_dirs': [
        './'
      ],
      'sources': [
        'src/vbucket/ketama.c',
        'src/vbucket/vbucket.c'
      ],
      'dependencies': [
        'cjson'
      ]
    },

    #libsnappy
    {
      'target_name': 'snappy',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/snappy/snappy-c.cc',
        'contrib/snappy/snappy-sinksource.cc',
        'contrib/snappy/snappy-stubs-internal.cc',
        'contrib/snappy/snappy.cc',
      ],
      'cflags': [
        '-Wno-sign-compare'
      ],
      'xcode_settings': {
        'WARNING_CFLAGS': [
          '-Wno-sign-compare'
        ]
      }
    },

    #liblcbio
    {
      'target_name': 'lcbio',
      'product_prefix': 'lib',
      'type': 'static_library',
      'defines': [
        'LCB_NO_SSL'
      ],
      'include_dirs': [
        './'
      ],
      'sources': [
        'src/lcbio/connect.c',
        'src/lcbio/ctx.c',
        'src/lcbio/ioutils.c',
        'src/lcbio/iotable.c',
        'src/lcbio/protoctx.c',
        'src/lcbio/manager.c',
        'src/lcbio/ioutils.c',
        'src/lcbio/timer.c'
      ]
    },

    #libcouchbase_utils
    {
      'target_name': 'couchbase_utils',
      'product_prefix': 'lib',
      'type': 'static_library',
      'defines': [
        'LCB_NO_SSL'
      ],
      'include_dirs': [
        './'
      ],
      'sources': [
        'contrib/genhash/genhash.c',
        'src/strcodecs/base64.c',
        'src/strcodecs/url_encoding.c',
        'src/gethrtime.c',
        'src/hashtable.c',
        'src/hashset.c',
        'src/hostlist.c',
        'src/list.c',
        'src/logging.c',
        'src/packetutils.c',
        'src/ringbuffer.c',
        'src/simplestring.c'
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
        'CBSASL_STATIC',
        'LCB_NO_SSL'
      ],
      'cflags': [
        '-fno-strict-aliasing',
        '-Wno-missing-field-initializers'
      ],
      'xcode_settings': {
        'WARNING_CFLAGS': [
          '-fno-strict-aliasing',
          '-Wno-missing-field-initializers'
        ]
      },
      'include_dirs': [
        './'
      ],
      'sources': [
        # netbuf
        'src/netbuf/netbuf.c',

        # mcreq
        'src/mc/mcreq.c',
        'src/mc/compress.c',
        'src/mc/forward.c',

        # rdb
        'src/rdb/rope.c',
        'src/rdb/bigalloc.c',
        'src/rdb/chunkalloc.c',
        'src/rdb/libcalloc.c',

        # lcbht
        'src/lcbht/lcbht.c',
        'contrib/http_parser/http_parser.c',

        ## ssl
        ##'src/ssl/ssl_c.c',
        ##'src/ssl/ssl_common.c',
        ##'src/ssl/ssl_e.c',

        ## opfiles
        'src/operations/counter.c',
        'src/operations/get.c',
        'src/operations/touch.c',
        'src/operations/observe.c',
        'src/operations/durability.c',
        'src/operations/store.c',
        'src/operations/stats.c',
        'src/operations/remove.c',
        'src/operations/pktfwd.c',

        'src/bootstrap.c',
        'src/bucketconfig/bc_cccp.c',
        'src/bucketconfig/bc_http.c',
        'src/bucketconfig/bc_file.c',
        'src/bucketconfig/bc_mcraw.c',
        'src/bucketconfig/confmon.c',
        'src/callbacks.c',
        'src/cntl.c',
        'src/connspec.c',
        'src/handler.c',
        'src/getconfig.c',
        'src/http/http.c',
        'src/http/http_io.c',
        'src/instance.c',
        'src/mcserver/negotiate.c',
        'src/mcserver/mcserver.c',
        'src/newconfig.c',
        'src/nodeinfo.c',
        'src/iofactory.c',
        'src/retryq.c',
        'src/retrychk.c',
        'src/settings.c',
        'src/synchandler.c',
        'src/timer.c',
        'src/timings.c',
        'src/utilities.c',
        'src/wait.c',

        'plugins/io/select/plugin-select.c'
      ],
      'dependencies': [
        'couchbase_utils',
        'vbucket',
        'cbsasl',
        'snappy',
        'lcbio'
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
        }]
      ]
    }
  ]
}