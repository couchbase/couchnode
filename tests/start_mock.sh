#! /bin/sh
#
#     Copyright 2013 Couchbase, Inc.
#
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
#
#       http://www.apache.org/licenses/LICENSE-2.0
#
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#

if ! [ -f tests/CouchbaseMock.jar ]
then
    echo "Downloading Couchbase Mock Server"
    curl -s -L -o tests/CouchbaseMock.jar http://files.couchbase.com/maven2/org/couchbase/mock/CouchbaseMock/0.5-SNAPSHOT/CouchbaseMock-0.5-20120726.220757-19.jar
    echo "Done"
fi

echo "Starting the mock server"
exec java \
       -client \
       -jar tests/CouchbaseMock.jar \
        --nodes=10 \
        --host=localhost \
        --port=9000 \
        "$@"
