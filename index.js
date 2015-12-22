require('dotenv').load();
var performSync = require('./lib');

exports.handler = function(event, context) {
  performSync()
    .then(function (result) {
      console.log(result);
      console.log('DONE');
      return result;
    })
    .asCallback(context.done);
}
