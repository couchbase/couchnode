# Common flags for libcouchbase modules. This defines the specific flags
# required for various compilation modes
# Exports:
#   LCB_CORE_CFLAGS:
#       C flags to be used by our "Core" modules. This contains
#       many warnings.
#   LCB_CORE_CXXFLAGS:
#       Like LCB_CORE_CFLAGS, but for C++
#
#   LCB_BASIC_CFLAGS
#       Basic C flags without extra warnings
#   LCB_BASIC_CXXFLAGS
#       Basic C++ flags without extra warnings.
#
# Note that global flags will still be modified for debug settings and the
# like.

MACRO(list2args VAR)
    STRING(REPLACE ";" " " _tmp "${${VAR}}")
    SET("${VAR}" "${_tmp}")
ENDMACRO(list2args)

LIST(APPEND LCB_GNUC_CPP_WARNINGS
    -Wall -pedantic -Wshadow -fdiagnostics-show-option -Wformat
    -fno-strict-aliasing -Wno-strict-aliasing -Wextra -Winit-self)
list2args(LCB_GNUC_CPP_WARNINGS)

LIST(APPEND LCB_GNUC_C_WARNINGS
    ${LCB_GNUC_CPP_WARNINGS}
    -std=gnu99
    -Wundef -Wstrict-prototypes -Wmissing-prototypes -Wredundant-decls
    -Wmissing-declarations)
list2args(LCB_GNUC_C_WARNINGS)

LIST(APPEND LCB_GNUC_CXX_WARNINGS
    ${LCB_GNUC_CPP_WARNINGS}
    -std=gnu++98 -Woverloaded-virtual -Wnon-virtual-dtor -Wctor-dtor-privacy
    -Wno-long-long -Wredundant-decls)
list2args(LCB_GNUC_CXX_WARNINGS)

#MSVC-specific flags for C/C++
LIST(APPEND LCB_CL_CPPFLAGS /nologo /W3 /MP /EHsc)
list2args(LCB_CL_CPPFLAGS)

# Common flags for DEBUG
LIST(APPEND LCB_CL_CPPFLAGS_DEBUG /RTC1)
list2args( LCB_CL_CPPFLAGS_DEBUG)

# Common flags for RELEASE
LIST(APPEND LCB_CL_CPPFLAGS_REL /O2)
list2args(LCB_CL_CPPFLAGS_REL)

IF(${MSVC})
    ADD_DEFINITIONS(-D_CRT_SECURE_NO_WARNINGS)
    # Don't warn about "deprecated POSIX names"
    ADD_DEFINITIONS(-D_CRT_NONSTDC_NO_DEPRECATE)

    # Need this for VS 2012 for googletest and C++
    IF(MSVC_VERSION EQUAL 1700 OR MSVC_VERSION GREATER 1700)
        ADD_DEFINITIONS(-D_VARIADIC_MAX=10)
    ENDIF()
    SET(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} /TC ${LCB_CL_CPPFLAGS}")
    SET(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${LCB_CL_CPPFLAGS}")
    SET(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} ${LCB_CL_CPPFLAGS_DEBUG}")
    SET(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} ${LCB_CL_CPPFLAGS_DEBUG}")
    SET(CMAKE_C_FLAGS_RELEASE "${CMAKE_C_FLAGS_RELEASE} ${LCB_CL_CPPFLAGS_REL}")
    SET(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} ${LCB_CL_CPPFLAGS_REL}")

    # put debug info into release build and revert /OPT defaults after
    # /DEBUG so that it won't degrade performance and size
    # http://msdn.microsoft.com/en-us/library/xe4t6fc1(v=vs.80).aspx
    SET(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} /OPT:REF /OPT:ICF")
    SET(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} /OPT:REF /OPT:ICF")
    SET(LCB_CORE_CXXFLAGS "")
    SET(LCB_CORE_CFLAGS "")
    SET(LCB_BASIC_CFLAGS "")
    SET(LCB_BASIC_CXXFLAGS "")

ELSE()
    # GCC
    IF(WIN32)
        SET(CMAKE_C_FLAGS_DEBUG "${CMAKE_C_FLAGS_DEBUG} -gstabs")
        SET(CMAKE_CXX_FLAGS_DEBUG "${CMAKE_CXX_FLAGS_DEBUG} -gstabs")
        SET(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} -static-libgcc -static-libstdc++")
    ENDIF()
    SET(LCB_CORE_CFLAGS "${LCB_GNUC_C_WARNINGS}")
    SET(LCB_CORE_CXXFLAGS "${LCB_GNUC_CXX_WARNINGS}")
ENDIF()

IF(LCB_UNIVERSAL_BINARY AND (${CMAKE_SYSTEM_NAME} MATCHES "Darwin"))
    SET(CMAKE_C_FLAGS
        "${CMAKE_C_FLAGS} -force_cpusubtype_ALL -arch i386 -arch x86_64")
ENDIF()
