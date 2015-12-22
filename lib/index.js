var rp = require('request-promise');
var Promise = require('bluebird');
var _ = require('lodash');

var harvestAuth = encodeAuth(process.env.HARVEST_USER, process.env.HARVEST_PASS);
var zendeskAuth = encodeAuth(process.env.ZENDESK_USER, process.env.ZENDESK_TOKEN);

var ZENDESK_CLIENT_FIELD_ID = 29557247;
var ZENDESK_PROJECT_FIELD_ID = 29084117;

var DEFAULT_CLIENT_FIELD_OPTIONS = [
  {name: 'Other', value: 'client-other'}
]

var DEFAULT_PROJECT_FIELD_OPTIONS = [
  {name: 'Other', value: 'project-other'}
]

module.exports = function(done) {
  return getHarvestData()
    .spread(syncToZendesk);
}

function getHarvestData() {
  return getProjects();
}

function getProjects() {
  var projects;

  var requestParams = {
    method: 'GET',
    uri: 'https://' + process.env.HARVEST_DOMAIN + '/projects',
    headers: {
      'Authorization': 'Basic ' + harvestAuth,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    qs: {
      'updated_since': '2013-01-01+00%3A00'
    },
    json: true
  }

  console.log('GETTING PROJECTS FROM HARVEST');

  return rp(requestParams).then(function(projects) {
    // console.log(projects);
    return getClients(projects);
  });
}

function getClients(harvestProjects) {

  var clientIds = _.keys(_.groupBy(harvestProjects, function(p) {
    return p.project.client_id;
  }));

  console.log('GETTING CLIENTS FROM HARVEST');

  return Promise.map(clientIds, function(id) {
    var requestParams = {
      method: 'GET',
      uri: 'https://' + process.env.HARVEST_DOMAIN + '/clients/' + id,
      headers: {
        'Authorization': 'Basic ' + harvestAuth,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      json: true
    }

    return rp(requestParams).then(function(client) {
      return client;
    });
  },{
    concurrency: 5
  })
  .then(function (clients) {
    return [clients, harvestProjects];
  })
}

function syncToZendesk(harvestClients, harvestProjects) {
  console.log('SYNC TO ZENDESK');

  return Promise.all([
    getZendeskClientField(),
    getZendeskProjectField(),
  ])
  .spread(function (zendeskClientField, zendeskProjectField) {
    return Promise.all([
      prepareZendeskClientFieldOptions(
        zendeskClientField,
        harvestClients
      ),
      prepareZendeskProjectFieldOptions(
        zendeskProjectField,
        harvestClients,
        harvestProjects
      )
    ])
  })
  .spread(function (zendeskClientFieldOptions, zendeskProjectFieldOptions) {

    return Promise.all([
      updateZendeskClientField(zendeskClientFieldOptions),
      updateZendeskProjectField(zendeskProjectFieldOptions)
    ]);

  })
}

function getZendeskClientField() {
  var requestParams = {
    method: 'GET',
    uri: 'https://' + process.env.ZENDESK_DOMAIN + '/api/v2/ticket_fields/' + ZENDESK_CLIENT_FIELD_ID + '.json',
    headers: {
      'Authorization': 'Basic ' + zendeskAuth,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: true
  }

  console.log('GETTING ZENDESK CLIENT FIELD');

  return rp(requestParams).then(function (zendeskClientField) {
    // console.log(zendeskClientField);
    return zendeskClientField;
  })
}

function getZendeskProjectField() {
  var requestParams = {
    method: 'GET',
    uri: 'https://' + process.env.ZENDESK_DOMAIN + '/api/v2/ticket_fields/' + ZENDESK_PROJECT_FIELD_ID + '.json',
    headers: {
      'Authorization': 'Basic ' + zendeskAuth,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    json: true
  }

  console.log('GETTING ZENDESK PROJECT FIELD');

  return rp(requestParams).then(function (zendeskProjectField) {
    // console.log(zendeskProjectField);
    return zendeskProjectField;
  })
}

function prepareZendeskClientFieldOptions(zendeskClientField, harvestClients) {
  var fieldOptions = zendeskClientField.ticket_field.custom_field_options;

  console.log('PREPARING ZENDESK CLIENT FIELD OPTIONS');

  // console.log(harvestClients);
  var options = _.map(harvestClients, function (item) {
    var client = item.client;
    return {
      name: client.name,
      value: _.kebabCase([
        'client',
        client.id,
        client.name
      ].join(' '))
    };
  })

  options = _.sortBy(options, 'name');

  options = options.concat(DEFAULT_CLIENT_FIELD_OPTIONS);

  return options;
}

function prepareZendeskProjectFieldOptions(zendeskProjectField, harvestClients, harvestProjects) {
  var fieldOptions = zendeskProjectField.ticket_field.custom_field_options;

  console.log('PREPARING ZENDESK PROJECT FIELD OPTIONS');

  // console.log(harvestProjects);
  var options = _.map(harvestProjects, function (item) {
    var project = item.project;
    var client = _.where(harvestClients, { client: { id: project.client_id } });

    if (client.length === 0) {
      console.warn(project.client_id + ' WAS NOT FOUND');
    }

    return {
      name: client[0].client.name + '::' + project.name,
      value: _.kebabCase([
        'project',
        project.id,
        project.name
      ].join(' '))
    };
  });

  options = _.sortBy(options, 'name');

  options = options.concat(DEFAULT_PROJECT_FIELD_OPTIONS);

  return options;
}

function updateZendeskClientField(fieldOptions) {
  var requestParams = {
    method: 'PUT',
    uri: 'https://' + process.env.ZENDESK_DOMAIN + '/api/v2/ticket_fields/' + ZENDESK_CLIENT_FIELD_ID + '.json',
    headers: {
      'Authorization': 'Basic ' + zendeskAuth,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: {
      ticket_field: {
        custom_field_options: fieldOptions
      }
    },
    json: true
  }

  console.log('UPDATE ZENDESK CLIENT FIELD');

  return rp(requestParams);
}

function updateZendeskProjectField(fieldOptions) {
  var requestParams = {
    method: 'PUT',
    uri: 'https://' + process.env.ZENDESK_DOMAIN + '/api/v2/ticket_fields/' + ZENDESK_PROJECT_FIELD_ID + '.json',
    headers: {
      'Authorization': 'Basic ' + zendeskAuth,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: {
      ticket_field: {
        custom_field_options: fieldOptions
      }
    },
    json: true
  }

  console.log('UPDATE ZENDESK PROJECT FIELD');

  return rp(requestParams);
}


function encodeAuth(user, pass) {
  return new Buffer(user + ':' + pass).toString('base64')
}
