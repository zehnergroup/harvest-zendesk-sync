require('dotenv').load();

var Promise = require('bluebird');
var gulp = require('gulp');
var gutil = require('gulp-util');
var del = require('del');
var rename = require('gulp-rename');
var install = require('gulp-install');
var zip = require('gulp-zip');
var AWS = require('aws-sdk');
var fs = Promise.promisifyAll(require('fs'), {suffix: 'P'});
var runSequence = require('run-sequence');
var _ = require('lodash');
var pkg = require('./package.json');

// First we need to clean out the dist folder and remove the compiled zip file.
gulp.task('clean', function() {
  return del(['./dist', './archive.zip']);
});

// The js task could be replaced with gulp-coffee as desired.
gulp.task('js', function() {
  return gulp.src(['index.js', './lib/**/*'], {base: './'})
    .pipe(gulp.dest('dist/'))
});

// Here we want to install npm packages to dist, ignoring devDependencies.
gulp.task('npm', function() {
  return gulp.src('./package.json')
    .pipe(gulp.dest('./dist/'))
    .pipe(install({production: true}));
});

// Next copy over environment variables managed outside of source control.
gulp.task('env', function() {
  return gulp.src('./config.env.production')
    .pipe(rename('.env'))
    .pipe(gulp.dest('./dist'))
});

// Now the dist directory is ready to go. Zip it.
gulp.task('zip', function() {
  return gulp.src(['dist/**/*', '!dist/package.json', 'dist/.*'])
    .pipe(zip('dist.zip'))
    .pipe(gulp.dest('./'));
});

// Upload (and if nessisary create) new code to function
gulp.task('upload', function() {

  var lambdaConfig = {
    accessKeyId: process.env.AWS_KEY,
    secretAccessKey: process.env.AWS_SECRET,
    region: process.env.AWS_LAMBDA_REGION
  }
  var lambda = Promise.promisifyAll(new AWS.Lambda(lambdaConfig), {suffix: 'P'});

  return lambda.listFunctionsP({MaxItems: 100})
    .then(function (response) {
      var Functions = response.Functions;
      var r = [];

      if (Functions && _.where(Functions, {FunctionName: pkg.name}).length > 0) {
        console.log('Function Found');
        r.push(true);
      } else {
        console.log('Function NOT Found');
        r.push(false);
      }

      r.push(fs.readFileP('./dist.zip'));

      return r;

    })
    .spread(function (found, fileData) {
      if (found) {
        return Promise.all([
          lambda.updateFunctionConfigurationP({
            FunctionName: pkg.name,
            Description: pkg.description,
            MemorySize: parseInt(process.env.AWS_LAMBDA_MEMORY_SIZE),
            Timeout: parseInt(process.env.AWS_LAMBDA_TIMEOUT),
            Role: process.env.AWS_LAMBDA_ROLE
          }),
          lambda.updateFunctionCodeP({
            FunctionName: pkg.name,
            ZipFile: fileData,
            Publish: true
          })
        ])
      } else {
        return lambda.createFunctionP({
          FunctionName: pkg.name,
          Description: pkg.description,
          Runtime: 'nodejs',
          Role: process.env.AWS_LAMBDA_ROLE,
          Handler: 'index.handler',
          MemorySize: parseInt(process.env.AWS_LAMBDA_MEMORY_SIZE),
          Timeout: parseInt(process.env.AWS_LAMBDA_TIMEOUT),
          Publish: true,
          Code: {
            ZipFile: fileData
          },
        })
      }
    })
    .then(function (response) {
      return console.log(response);
    })
    .catch(function (err) {
      console.log(err);
      throw err;
    });
});

// The key to deploying as a single command is to manage the sequence of events.
gulp.task('default', function(callback) {
  return runSequence(
    'clean',
    ['js', 'npm', 'env'],
    'zip',
    'upload',
    callback
  );
});

// The key to deploying as a single command is to manage the sequence of events.
gulp.task('build', function(callback) {
  console.log('BUILDING');
  return runSequence(
    'clean',
    ['js', 'npm', 'env'],
    'zip',
    callback
  );
});
