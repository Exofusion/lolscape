// riot_api
//
// This class exposes methods allowing access to Riot's API endpoints
// Each function is structured around the following control flow:
//
// 1. Exposed function call
// 2. Build endpoint URL with input parameters
// 3. handleResponse() checks status codes and readies the response body
// 4. Execution passed back to the caller via callback function

// Required modules
var request = require('request');

// API key JSON file should be formatted as: { "api_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
var api_key = require('./api_key.json').api_key;

// Map a region code to platform code
// Example: platformLookup('na') => 'na1'
var platform = { 'na': 'na1',
                 'br': 'br1',
                 'eune': 'eun1',
                 'euw': 'euw1',
                 'jp': 'jp1',
                 'kr': 'kr',
                 'lan': 'la1',
                 'las': 'la2',
                 'oce': 'oc1',
                 'tr': 'tr1',
                 'ru': 'ru' };
function platformLookup(region) {
	return platform[region.toLowerCase()];
}

// Input parameters: error, response, body from a 'request' connection
//                   callback with which to return operation
// Output: response body if no errors via callback, otherwise null
function handleResponse(error, response, body, callback) {
  if (body == undefined) {
    console.log('[???] Response body undefined');
    return callback(null);
  } else {
    var parsed_json;
    
    try {
      parsed_json = JSON.parse(body);
    } catch (e) {
      console.error(e)
      return callback(null);
    }
    
    if (parsed_json.status) {
      if (parsed_json.status.status_code == 403) {
        console.log('[403] Forbidden');
        return callback(null);
      } else if (parsed_json.status.status_code == 404) {
        console.log('[404] Not Found');
        return callback(null);
      }
    }
  }
  
  callback(body);
}

// Helper functions to build endpoint URL's
function buildURLBase(region) {
	return `https://${region}.api.pvp.net`;
}

// Endpoint: /championmastery/location/{platformId}/player/{playerId}/champions
function buildChampionMasteryLink(region, summoner_id) {
	return `${buildURLBase(region)}/championmastery/location/${platformLookup(region)}/player/${summoner_id}/champions?api_key=${api_key}`;
}

// Endpoint: /api/lol/{region}/v1.4/summoner/by-name/{summonerNames}
function buildSummonerNameLink(region, summoner_name) {
  return `${buildURLBase(region)}/api/lol/${region}/v1.4/summoner/by-name/${summoner_name}?api_key=${api_key}`;
}

// Endpoint: /api/lol/{region}/v1.4/summoner/{summonerIds}
function buildSummonerIdLink(region, summoner_id) {
  return `${buildURLBase(region)}/api/lol/${region}/v1.4/summoner/${summoner_id}?api_key=${api_key}`;
}

exports.getAllChampionMasteryEntries = function(region, summoner_id, callback) {
	request(buildChampionMasteryLink(region, summoner_id),
    function(error, response, body) {
      handleResponse(error, response, body, callback);
    }
	);
}

exports.getSummonerDataByName = function(region, summoner_name, callback) {
  if (summoner_name && summoner_name.length > 0) {
    request(buildSummonerNameLink(region, summoner_name),
      function(error, response, body) {
        handleResponse(error, response, body, callback);
      }
    );
  } else {
    callback(null);
  }
};

exports.getSummonerDataById = function(region, summoner_id, callback) {
  request(buildSummonerIdLink(region, summoner_id),
    function(error, response, body) {
      handleResponse(error, response, body, callback);
    }
  );
};