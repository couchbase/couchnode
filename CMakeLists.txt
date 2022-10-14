cmake_minimum_required(VERSION 3.17)
cmake_policy(SET CMP0042 NEW)
cmake_policy(SET CMP0048 NEW)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Set up some build requirements for Windows.
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")
if(WIN32)
  add_definitions(/bigobj)
  add_definitions(-D_WIN32_WINNT=0x0601)
endif()

# We need to import this globally in order for OpenSSL to be available
# to our dependant libraries such as couchbase-cxx-client.
include_directories(${CMAKE_JS_INC})

set(COUCHBASE_CXX_CLIENT_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_POST_LINKED_OPENSSL ON CACHE BOOL "" FORCE)
set(COUCHBASE_CXX_CLIENT_STATIC_STDLIB ON CACHE BOOL "" FORCE)
add_subdirectory(deps/couchbase-cxx-client)

project (couchbase_impl)

file(GLOB SOURCE_FILES "src/*.cpp")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})

add_definitions(-DNAPI_VERSION=6)
target_include_directories(${PROJECT_NAME}
  PRIVATE ${CMAKE_JS_INC}
          "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api"
          "deps/couchbase-cxx-client/include"
          "deps/couchbase-cxx-client/third_party/asio/asio/include")
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")

target_link_libraries(${PROJECT_NAME}
  ${CMAKE_JS_LIB}
  couchbase_cxx_client
)

# Workaround a bug in cmake-js with removal of used references:
# https://github.com/cmake-js/cmake-js/issues/205
if(MSVC)
    target_link_options(${PROJECT_NAME} PUBLIC /OPT:NOREF)
endif()
