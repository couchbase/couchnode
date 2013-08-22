/* -*- Mode: C++; tab-width: 4; c-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
 *     Copyright 2013 Couchbase, Inc.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */

#ifndef COUCHNODE_CMDLIST_H
#define COUCHNODE_CMDLIST_H

#ifndef COUCHBASE_H
#error "include couchnode_impl.h first"
#endif

namespace Couchnode {
/**
 * This structure abstracts away the allocation and deletion of each
 * individual libcouchbase command. This should always be allocated on
 * the stack.
 */


template <typename T>
class CommandList
{
public:
    bool initialize(unsigned int n) {
        ncmds = n;

        if (ncmds == 1) {
            cmds = &single_cmd;
            cmdlist = &cmds;
            memset(&single_cmd, 0, sizeof(single_cmd));

        } else if (ncmds > 1) {
            cmds = NULL;
            cmdlist = NULL;

            cmds = new T[ncmds];
            cmdlist = new T*[ncmds];

            if (cmds == NULL || cmdlist == NULL) {
                return false;
            }

            memset(cmds, 0, sizeof(T) * n);

        } else {
            return false;
        }

        return true;
    }

    T* getAt(unsigned int ix) {
        if (ix == ncmds) {
            return NULL;
        }

        T *ret;
        if (ncmds == 1) {
            ret = (T *)&single_cmd;

        } else {
            ret = ((T*)cmds) + ix;
            cmdlist[ix] = ret;
        }

        return ret;
    }

    const T * const * getList() {
        return cmdlist;
    }

    unsigned int size() const {
        return ncmds;
    }

    CommandList(CommandList& other) {
        ncmds = other.ncmds;

        if (ncmds < 2) {
            memcpy(&single_cmd, &other.single_cmd, sizeof(single_cmd));
            cmds = &single_cmd;
            cmdlist = &cmds;
        } else {
            cmds = other.cmds;
            cmdlist = other.cmdlist;
        }

        other.cmds = NULL;
        other.cmdlist = NULL;
        other.ncmds = 0;
    }

    CommandList() :cmds(NULL), cmdlist(NULL), ncmds(0) {}

    ~CommandList() {
        if (ncmds < 2) {
            return;
        }
        delete[] cmds;
        delete[] cmdlist;
    }

protected:
    T single_cmd;
    T *cmds;
    T ** cmdlist;
    unsigned int ncmds;
};

};

#endif
