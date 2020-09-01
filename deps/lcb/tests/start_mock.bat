@ECHO OFF
SET lcbdir=%srcdir%
IF "%lcbdir%"=="" (
    SET lcbdir=.
)

SET MOCKPATH=%lcbdir%\tests\CouchbaseMock.jar

java ^
    -client^
    -jar "%MOCKPATH%"^
    --cccp^
    --nodes=4^
    --host=localhost^
    --port=0^
    %*
