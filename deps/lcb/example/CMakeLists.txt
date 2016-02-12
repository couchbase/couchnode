# This builds the examples; all these targets are optional
SET(CMAKE_RUNTIME_OUTPUT_DIRECTORY "${CMAKE_RUNTIME_OUTPUT_DIRECTORY}/examples")

MACRO(ADD_EXAMPLE name dir linkspec incspec)
    SET(dir "${CMAKE_CURRENT_SOURCE_DIR}/${dir}")
    FILE(GLOB _cur_src ${dir}/*.cc ${dir}/*.c ${dir}/*.cpp)
    ADD_EXECUTABLE(${name} ${_cur_src})
    TARGET_LINK_LIBRARIES(${name} couchbase ${linkspec})

    GET_TARGET_PROPERTY(_tmp_inc ${name} INCLUDE_DIRECTORIES)
    LIST(APPEND ${_tmp_inc} ${dir} ${incspec})
    SET_TARGET_PROPERTIES(${name} PROPERTIES INCLUDE_DIRECTORIES "${_tmp_inc}")
ENDMACRO()

# ADD_EXAMPLE(db db "" "")
ADD_EXECUTABLE(db db/db.c)
ADD_EXECUTABLE(vb db/vb.c)
TARGET_LINK_LIBRARIES(db couchbase)
TARGET_LINK_LIBRARIES(vb couchbase)

ADD_EXAMPLE(mcc mcc "" "")
ADD_EXAMPLE(minimal minimal "" "")
ADD_EXAMPLE(observe observe "" "")
ADD_EXAMPLE(views-example views "" "")
ADD_EXAMPLE(tick tick "" "")

ADD_EXECUTABLE(subdoc-simple subdoc/subdoc-simple.cc)
ADD_EXECUTABLE(subdoc-multi subdoc/subdoc-multi.cc)
TARGET_LINK_LIBRARIES(subdoc-simple couchbase)
TARGET_LINK_LIBRARIES(subdoc-multi couchbase)

IF(NOT WIN32)
    ADD_EXAMPLE(instancepool instancepool pthread "")
ENDIF()
IF(HAVE_LIBEVENT2)
    ADD_EXAMPLE(libevent-direct libeventdirect ${LIBEVENT_LIBRARIES} ${LIBEVENT_INCLUDE_DIR})
ENDIF()
