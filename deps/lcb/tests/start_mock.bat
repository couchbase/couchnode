@ECHO OFF
SET lcbdir=%srcdir%
IF "%lcbdir%"=="" (
    SET lcbdir=.
)

SET MOCKPATH=%lcbdir%\tests\CouchbaseMock.jar

java ^
    -client^
    -jar "%MOCKPATH%"^
    --nodes=10^
    --host=localhost^
    --port=0^
    %*
