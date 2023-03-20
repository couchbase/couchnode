cmake_minimum_required(VERSION 3.17)
cmake_policy(SET CMP0042 NEW)
cmake_policy(SET CMP0048 NEW)
include(FetchContent)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

function(download_nodejs_headers)
  message("Finding Node.js headers SHA for version: ${NODE_RUNTIMEVERSION}")
  file(DOWNLOAD
    https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}/SHASUMS256.txt
    "${CMAKE_CURRENT_BINARY_DIR}/SHASUM256.txt"
    TLS_VERIFY ON)

  file(READ "${CMAKE_CURRENT_BINARY_DIR}/SHASUM256.txt" HASH_FILE_CONTENT)
  set(REGEX_CHECK "node-v${NODE_RUNTIMEVERSION}-headers.tar.gz")
  string(REPLACE "\n" ";" HASH_FILE_CONTENT ${HASH_FILE_CONTENT})
  FOREACH(HASH ${HASH_FILE_CONTENT})
    string(FIND ${HASH} ${REGEX_CHECK} FOUND_FILE)
    if("${FOUND_FILE}" GREATER_EQUAL "0")
      string(REGEX MATCH
            "^[0-9a-f]+"
            CB_NODE_VERSION_SHA256
            ${HASH})
      break()
    endif()
  ENDFOREACH()

  if(NOT CB_NODE_VERSION_SHA256)
    message(FATAL_ERROR "Failed to extract expected hash from node shasum file.")
  else()
    message("Using SHA=${CB_NODE_VERSION_SHA256}")
  endif()
  if(${CMAKE_VERSION} VERSION_GREATER_EQUAL "3.24.0")
    # see https://cmake.org/cmake/help/latest/policy/CMP0135.html
    # and Externalproject_add - DOWNLOAD_EXTRACT_TIMESTAMP
    FetchContent_Declare(
      nodejs_headers
      URL https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}/node-v${NODE_RUNTIMEVERSION}-headers.tar.gz
      URL_HASH SHA256=${CB_NODE_VERSION_SHA256}
      DOWNLOAD_EXTRACT_TIMESTAMP FALSE
      )
  else()
    FetchContent_Declare(
      nodejs_headers
      URL https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}/node-v${NODE_RUNTIMEVERSION}-headers.tar.gz
      URL_HASH SHA256=${CB_NODE_VERSION_SHA256}
      )  
  endif()
  
  message("Downloading Node.js ${NODE_RUNTIMEVERSION} headers...")
  FetchContent_MakeAvailable(nodejs_headers)
  message("Downloaded Node.js ${NODE_RUNTIMEVERSION} headers to ${nodejs_headers_SOURCE_DIR}")
  set(NODEJS_INC_DIR "${nodejs_headers_SOURCE_DIR}/include/node" PARENT_SCOPE)
endfunction()

function(download_nodejs_win_lib)
  if(NODE_RUNTIME STREQUAL "electron")
    set(NODE_LIB_URL "https://artifacts.electronjs.org/headers/dist/v${NODE_RUNTIMEVERSION}")
    if(NODE_ARCH STREQUAL "x64")
      set(NODE_LIB_URL "${NODE_LIB_URL}/x64")
    endif()
  else()
    set(NODE_LIB_URL "https://nodejs.org/dist/v${NODE_RUNTIMEVERSION}")
    if(NODE_ARCH STREQUAL "x64")
      set(NODE_LIB_URL "${NODE_LIB_URL}/win-x64")
    else()
      set(NODE_LIB_URL "${NODE_LIB_URL}/win-x86")
    endif()
  endif()
  set(NODE_LIB_URL "${NODE_LIB_URL}/node.lib")
  
  FetchContent_Declare(
    nodejs_win_lib
    URL ${NODE_LIB_URL}
    DOWNLOAD_NO_EXTRACT TRUE
    )

  message("Downloading ${NODE_RUNTIME} v${NODE_RUNTIMEVERSION} win lib...")
  FetchContent_MakeAvailable(nodejs_win_lib)
  message("Downloaded ${NODE_RUNTIME} v${NODE_RUNTIMEVERSION} win lib to ${nodejs_win_lib_SOURCE_DIR}")
  set(NODEJS_LIB "${nodejs_win_lib_SOURCE_DIR}/node.lib" PARENT_SCOPE)
endfunction()

# cmake-js >= v7.0 no longer downloads the full Node.js Windows lib and utilizes the https://github.com/nodejs/node-api-headers
# project to build the lib.  Since we rely on OpenSSL we need to pull in more than just the node-api headers, so lets download
# the node.lib ourselves.
if(WIN32 AND CMAKE_JS_VERSION VERSION_GREATER_EQUAL "7.0.0")
  SET(NODEJS_LIB "")
  download_nodejs_win_lib()
else()
  SET(NODEJS_LIB "${CMAKE_JS_LIB}")
endif()

if(CMAKE_JS_VERSION VERSION_GREATER_EQUAL "7.0.0")
  set(NODEJS_INC_DIR "")
  download_nodejs_headers()
  set(NODEJS_INC_DIR "${NODEJS_INC_DIR};${CMAKE_JS_INC}")
else()
  set(NODEJS_INC_DIR "${CMAKE_JS_INC}")
endif()

message(STATUS "NODEJS_INC_DIR=${NODEJS_INC_DIR}")
message(STATUS "NODEJS_LIB=${NODEJS_LIB}")

# Set up some build requirements for Windows.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
if(WIN32)
  add_definitions(/bigobj)
  add_definitions(-D_WIN32_WINNT=0x0601)
endif()

# We need to import this globally in order for OpenSSL to be available
# to our dependant libraries such as couchbase-cxx-client.
include_directories(${NODEJS_INC_DIR})

set(COUCHBASE_CXX_CLIENT_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_TOOLS OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL ON CACHE BOOL "")
set(COUCHBASE_CXX_CLIENT_STATIC_STDLIB ON CACHE BOOL "" FORCE)
add_subdirectory(deps/couchbase-cxx-client)

project (couchbase_impl)

file(GLOB SOURCE_FILES "src/*.cpp")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

add_definitions(-DNAPI_VERSION=6)
if(CMAKE_JS_VERSION VERSION_GREATER_EQUAL "7.0.0")
  target_include_directories(${PROJECT_NAME}
    PRIVATE ${NODEJS_INC_DIR}
            "deps/couchbase-cxx-client/include"
            "deps/couchbase-cxx-client/third_party/asio/asio/include")
else()
  execute_process(COMMAND node -p "require('node-addon-api').include"
          WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
          OUTPUT_VARIABLE NODE_ADDON_API_DIR
          )
  string(REPLACE "\n" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
  string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})

  target_include_directories(${PROJECT_NAME}
    PRIVATE ${NODEJS_INC_DIR}
            ${NODE_ADDON_API_DIR}
            "deps/couchbase-cxx-client/include"
            "deps/couchbase-cxx-client/third_party/asio/asio/include")
endif()
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

target_link_libraries(${PROJECT_NAME}
  ${NODEJS_LIB}
  couchbase_cxx_client
)

if(MSVC)    
    # Workaround a bug in cmake-js with removal of used references:
    # https://github.com/cmake-js/cmake-js/issues/205
    target_link_options(${PROJECT_NAME} PUBLIC /OPT:NOREF)

    # since we only care about the *.PDB for a command line build, this _should_ be okay.
    if(CMAKE_BUILD_TYPE STREQUAL "Release")
        target_compile_options(${PROJECT_NAME} PUBLIC /Zi)

        # Do we want /OPT:ICF?
        set_target_properties(${PROJECT_NAME} PROPERTIES
          LINK_FLAGS "/INCREMENTAL:NO /DEBUG"
          COMPILE_PDB_NAME ${PROJECT_NAME} 
          COMPILE_PDB_OUTPUT_DIR ${CMAKE_BINARY_DIR}
        )
    endif()
endif()
