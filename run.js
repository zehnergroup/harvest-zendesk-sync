require('dotenv').load();

var performSync = require('./lib');

performSync()
  .then(function (result) {
    console.log(result);
    console.log('DONE');
    return result;
  })
  .catch(function (err) {
    console.log(err);
  });
