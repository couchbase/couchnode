    core.cb.get('index::users', 0, function(data, err, key, cas, flags, value){
      console.log('Get 1: ' + data, err, key, cas, flags, value);
      core.cb.set('index::users', value, 0, cas, function(data, err, key, cas) {
        console.log('Set 1: ' + data, err, key, cas);
      });
    });
    core.cb.get('index::users', 0, function(data, err, key, cas, flags, value){
      console.log('Get 2: ' + data, err, key, cas, flags, value);
      core.cb.set('index::users', value, 0, cas, function(data, err, key, cas) {
        console.log('Set 2: ' + data, err, key, cas);
      });
    });

/*
Results in the following output:
Get 1: undefined false index::users 94312808895741950 0 ::60::
Get 2: undefined false index::users 94312808895741950 0 ::60::
Set 1: undefined false index::users 166370402933669900
Set 2: undefined false index::users 238427996971597820

Shouldn't Set 2 fail because the CAS changed when Set 1 occurred?
*/
