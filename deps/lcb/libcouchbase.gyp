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
          'contrib/win32-defs'
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

    #libhttpparser
    {
      'target_name': 'httpparser',
      'product_prefix': 'lib',
      'type': 'static_library',
      'include_dirs': [
        './'
      ],
      'sources': [
        'contrib/http_parser/http_parser.c'
       ]
    },

    #libgenhash
    {
      'target_name': 'genhash',
      'product_prefix': 'lib',
      'type': 'static_library',
      'include_dirs': [
        './'
      ],
      'sources': [
        'contrib/genhash/genhash.c'
       ]
    },
    
    #libjsoncpp
    {
      'target_name': 'jsoncpp',
      'product_prefix': 'lib',
      'type': 'static_library',
      'sources': [
        'contrib/lcb-jsoncpp/lcb-jsoncpp.cpp'
       ],
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
      'cflags!': [
        '-fno-exceptions'
      ],
      'cflags_cc!': [
        '-fno-exceptions'
      ],
      'xcode_settings': {
        'WARNING_CFLAGS': [
          '-fno-strict-aliasing',
          '-Wno-missing-field-initializers'
        ],
        'GCC_ENABLE_CPP_EXCEPTIONS': 'YES'
      },
      'include_dirs': [
        './'
      ],
      'sources': [
        'src/bucketconfig/bc_cccp.c',
        'src/bucketconfig/bc_file.c',
        'src/bucketconfig/bc_http.c',
        'src/bucketconfig/bc_mcraw.c',
        'src/bucketconfig/confmon.c',
        'src/http/http.cc',
        'src/http/http_io.cc',
        'src/jsparse/parser.cc',
        'src/lcbht/lcbht.c',
        'src/lcbio/connect.c',
        'src/lcbio/ctx.c',
        'src/lcbio/iotable.c',
        'src/lcbio/ioutils.c',
        'src/lcbio/manager.c',
        'src/lcbio/protoctx.c',
        'src/lcbio/timer.c',
        'src/mc/compress.c',
        'src/mc/forward.c',
        'src/mc/mcreq.c',
        'src/mcserver/mcserver.c',
        'src/mcserver/negotiate.c',
        'src/netbuf/netbuf.c',
        'src/operations/cbflush.c',
        'src/operations/counter.c',
        'src/operations/durability-cas.c',
        'src/operations/durability-seqno.c',
        'src/operations/durability.c',
        'src/operations/get.c',
        'src/operations/observe-seqno.c',
        'src/operations/observe.c',
        'src/operations/touch.c',
        'src/operations/pktfwd.c',
        'src/operations/remove.c',
        'src/operations/stats.c',
        'src/operations/store.c',
        'src/operations/subdoc.cc',
        'src/operations/touch.c',
        'src/rdb/bigalloc.c',
        'src/rdb/chunkalloc.c',
        'src/rdb/libcalloc.c',
        'src/rdb/rope.c',
        ## 'src/ssl/ssl_c.c',
        ## 'src/ssl/ssl_common.c',
        ## 'src/ssl/ssl_e.c',
        'src/strcodecs/base64.c',
        'src/vbucket/ketama.c',
        'src/vbucket/vbucket.c',
        'src/views/docreq.c',
        'src/views/viewreq.c',
        'src/auth.cc',
        'src/bootstrap.c',
        'src/callbacks.c',
        'src/cbft.cc',
        'src/cntl.cc',
        'src/connspec.cc',
        'src/dump.c',
        'src/getconfig.c',
        'src/gethrtime.c',
        'src/handler.c',
        'src/hashset.c',
        'src/hashtable.c',
        ## 'src/hdr_timings.c',
        'src/hostlist.cc',
        'src/instance.cc',
        'src/iofactory.c',
        'src/legacy.c',
        'src/list.c',
        'src/logging.c',
        'src/newconfig.c',
        'src/nodeinfo.cc',
        'src/packetutils.c',
        'src/retrychk.c',
        'src/retryq.c',
        'src/ringbuffer.c',
        'src/settings.c',
        'src/simplestring.c',
        'src/timings.c',
        'src/utilities.c',
        'src/wait.c',

        'src/n1ql/n1ql.cc',
        'src/n1ql/ixmgmt.cc',
        'src/n1ql/params.cc',

        'plugins/io/select/plugin-select.c'
      ],
      'dependencies': [
        'httpparser',
        'genhash',
        'cjson',
        'cbsasl',
        'snappy',
        'jsoncpp'
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
