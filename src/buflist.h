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

#ifndef COUCHNODE_BUFLIST_H
#define COUCHNODE_BUFLIST_H
#include <cstdlib>
namespace Couchnode
{

class BufferList
{
public:
    /**
     * This class helps avoid a lot of small allocations; we might want to
     * optimize this a bit later of course :)
     *
     * For now, it serves as a convenient place to allocate all our string
     * pointers without each command worrying about freeing them.
     */
    BufferList() : curBuf(NULL), bytesUsed(0), bytesAllocated(defaultSize) { }

    char *getBuffer(size_t len) {
        char *ret;
        if (!len) {
            return NULL;
        }

        if (len >= bytesAllocated) {
            ret = new char[len];
            bufList.push_back(ret);
            return ret;
        }

        if (!curBuf) {
            if (!(curBuf = new char[bytesAllocated])) {
                return NULL;
            }

            bufList.push_back(curBuf);
        }

        if (bytesAvailable() > len) {
            ret = curBuf;
            bytesUsed += len;
            curBuf += len;

        } else {
            curBuf = NULL;
            bytesUsed = 0;
            return getBuffer(len);
        }

        return ret;
    }

    bool empty() { return bufList.empty(); }

    ~BufferList() {
        for (unsigned int ii = 0; ii < bufList.size(); ii++) {
            delete[] bufList[ii];
        }
    }

private:
    inline size_t bytesAvailable() {
        return bytesAllocated - bytesUsed;
    }


    BufferList(BufferList& other) {
        bufList = other.bufList;
        bytesUsed = other.bytesUsed;
        bytesAllocated = other.bytesAllocated;
        curBuf = other.curBuf;

        other.bufList.clear();
        other.bytesUsed = 0;
        other.bytesAllocated = 0;
        other.curBuf = 0;
    }

    static const unsigned int defaultSize = 1024;
    std::vector<char *> bufList;
    char *curBuf;
    size_t bytesUsed;
    size_t bytesAllocated;

    friend class Command;

};
};
#endif
